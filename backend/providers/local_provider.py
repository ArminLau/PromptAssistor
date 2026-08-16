"""
Local LLM provider using llama-cpp-python.

Loads GGUF format models with optional multimodal projector (mmproj)
for vision-enabled models like Qwen2.5-VL, LLaVA, etc.
"""

import logging
from pathlib import Path
from typing import Any

# 注意: MODELS_DIR 是可变常量，会在 workspace_manager.apply_workspace() 时更新
# 必须通过 app.constants.MODELS_DIR 动态访问以获取最新值（工作空间覆盖后的值）
# Note: MODELS_DIR is mutable — updated by workspace_manager.apply_workspace().
# Must access via app.constants.MODELS_DIR to get the latest (workspace-overridden) value.
import app.constants as consts
from app.constants import PROJECT_ROOT, ProviderType
from .base import (
    BaseProvider,
    InferenceResult,
    ProviderConfig,
    ProviderError,
    ProviderInitError,
    ProviderNotAvailableError,
)
from utils.cuda_dll import setup_cuda_dll_search
from utils.file_handler import encode_image_to_data_url

logger = logging.getLogger(__name__)


def _resolve_model_path(raw_path: str) -> Path:
    """
    Resolve model path, handling both absolute and relative paths.
    / 解析模型路径，处理绝对路径和相对路径。

    Resolution order / 解析顺序:
    1. Absolute path → use as-is / 绝对路径 → 直接使用
    2. Relative path → try MODELS_DIR first (workspace), then PROJECT_ROOT
       / 相对路径 → 先尝试MODELS_DIR（工作空间），再尝试PROJECT_ROOT

    Note: MODELS_DIR is accessed dynamically via app.constants to get the
    workspace-overridden value (if workspace is enabled).
    / 注意: MODELS_DIR 通过 app.constants 动态访问以获取工作空间覆盖后的值。
    """
    if not raw_path:
        return Path()

    path = Path(raw_path)
    if path.is_absolute():
        return path

    # 动态获取 MODELS_DIR，确保使用工作空间覆盖后的值
    # Dynamic access to get workspace-overridden MODELS_DIR
    models_dir = consts.MODELS_DIR

    # Try models dir first (may be workspace override) / 先尝试models目录（可能是工作空间）
    candidate = models_dir / raw_path
    if candidate.exists():
        return candidate

    # Try project root / 再尝试项目根目录
    candidate = PROJECT_ROOT / raw_path
    if candidate.exists():
        return candidate

    # Fallback: return relative to MODELS_DIR (for clear error message)
    # / 兜底：返回相对于MODELS_DIR的路径（用于清晰的错误提示）
    return models_dir / raw_path


class LocalProvider(BaseProvider):
    """
    Provider for local GGUF models via llama-cpp-python.

    Supports:
    - Text-only generation
    - Multimodal generation (image input) when mmproj is configured
    - Streaming generation

    Model structure expected:
        models/
        └── ModelName/
            ├── model-Q4_K_M.gguf
            └── model.mmproj-f16.gguf  (optional, for vision)
    """

    def __init__(self) -> None:
        super().__init__()
        self._model = None  # llama_cpp.Llama instance
        self._model_path: Path | None = None  # 解析后的模型路径（延迟加载用）/ resolved model path
        self._mmproj_path: Path | None = None  # 解析后的 mmproj 路径 / resolved mmproj path
        self._has_vision = False
        self._vision_handler = None  # llama_cpp chat handler for vision (mtmd)

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.LOCAL

    async def initialize(self, config: ProviderConfig) -> bool:
        """
        Configure the local GGUF model (lightweight — does NOT load the model).
        / 配置本地 GGUF 模型（轻量 — 不加载模型）。

        模型在首次 generate() 时通过 _ensure_model_loaded() 延迟加载，
        避免程序启动即占用大量显存/内存。
        / The model is lazily loaded via _ensure_model_loaded() on first
        generate() to avoid consuming GPU/RAM at startup.

        Args:
            config: Must include model_path. Optionally mmproj_path for vision.

        Returns:
            True if the model is configured successfully.
        """
        self._config = config

        # Resolve model path (handles relative paths, workspace, etc.)
        # / 解析模型路径（处理相对路径、工作空间等）
        model_path = _resolve_model_path(config.model_path)
        logger.info(f"Resolved model path: {config.model_path} → {model_path}")

        if not model_path.exists():
            raise ProviderInitError(
                f"Model file not found / 模型文件未找到:\n"
                f"  Configured path / 配置路径: {config.model_path}\n"
                f"  Resolved path / 解析路径: {model_path}\n"
                f"  Models directory / 模型目录: {consts.MODELS_DIR}\n"
                f"  Project root / 项目根: {PROJECT_ROOT}\n"
                f"  Tip / 提示: Put .gguf file in models/ or use absolute path / 将.gguf放入models/或使用绝对路径",
                provider_type=self.provider_type.value,
            )

        self._model_path = model_path

        # 解析 mmproj 路径（若配置）/ resolve mmproj path (if configured)
        self._mmproj_path = None
        if config.mmproj_path:
            mmproj_path = _resolve_model_path(config.mmproj_path)
            if mmproj_path.exists():
                self._mmproj_path = mmproj_path
            else:
                logger.warning(f"mmproj file not found / 投影器未找到: {mmproj_path}")

        # 延迟加载：仅标记为已配置，模型在首次使用时再加载
        # / lazy load: only mark configured; the model loads on first use
        self._set_initialized(True)
        logger.info(
            f"Local provider configured (lazy load) / 本地后端已配置（延迟加载）: {model_path}"
        )
        return True

    def _ensure_model_loaded(self) -> None:
        """
        Load the model on first use (lazy), including the vision handler if configured.
        / 首次使用时加载模型（含视觉 handler，若已配置）。

        Raises:
            ProviderInitError: 若模型加载失败 / if the model fails to load.
        """
        if self._model is not None:
            return

        if self._model_path is None or not self._model_path.exists():
            raise ProviderInitError(
                "Model file not found / 模型文件未找到: "
                + (str(self._model_path) if self._model_path else "<未配置 / not configured>"),
                provider_type=self.provider_type.value,
            )

        try:
            # 在 import llama_cpp 之前准备好 CUDA DLL 搜索路径（否则 ggml-cuda.dll 加载失败）
            # Prepare CUDA DLL search path before importing llama_cpp (else ggml-cuda.dll fails)
            setup_cuda_dll_search()
            from llama_cpp import Llama

            extra = self._config.extra_params if self._config else {}
            # Build kwargs for Llama constructor
            kwargs: dict[str, Any] = {
                "model_path": str(self._model_path),
                "n_ctx": extra.get("n_ctx", 32768),
                "n_threads": extra.get("n_threads", 8),
                "verbose": False,
            }

            # GPU acceleration
            gpu_layers = extra.get("gpu_layers", 0)
            if gpu_layers != 0:
                kwargs["n_gpu_layers"] = gpu_layers

            # Load model (this is blocking — in production, run in thread pool)
            self._model = Llama(**kwargs)
            logger.info(f"Local model loaded: {self._model_path.name} (n_ctx={kwargs['n_ctx']})")
        except ImportError:
            raise ProviderInitError(
                "llama-cpp-python is not installed. Run: pip install llama-cpp-python",
                provider_type=self.provider_type.value,
            )
        except Exception as e:
            raise ProviderInitError(
                f"Failed to load local model: {e}",
                provider_type=self.provider_type.value,
                original_error=e,
            )

        # 多模态视觉支持检测 / Detect multimodal vision support.
        # `mtmd_support_vision()` 会真实校验模型是否支持视觉输入，
        # 纯文本模型即使配了 mmproj 也会被判为不支持。
        # / `mtmd_support_vision()` verifies whether the model really supports vision.
        self._has_vision = False
        self._vision_handler = None
        if self._mmproj_path is not None:
            self._vision_handler = self._create_vision_handler(str(self._mmproj_path))
            self._has_vision = self._vision_handler is not None
            if self._has_vision:
                logger.info(f"Vision support / 视觉支持: {self._mmproj_path}")
            else:
                logger.warning(
                    f"mmproj 已配置但模型不支持视觉（纯文本模型）/ "
                    f"mmproj configured but model does not support vision (text-only): "
                    f"{self._mmproj_path}"
                )

    async def ensure_ready(self) -> None:
        """懒加载入口：确保模型已加载 / lazy-load entry: ensure the model is loaded."""
        self._ensure_model_loaded()

    def _create_vision_handler(self, mmproj_path: str):
        """
        Create a vision chat handler and verify the model actually supports vision.
        / 创建视觉聊天处理器并校验模型是否真正支持视觉。

        Uses llama-cpp-python 0.3.x mtmd API:
        / 使用 llama-cpp-python 0.3.x 的 mtmd API：
        1. Load the mmproj projector via a vision chat handler.
           / 通过视觉 chat handler 加载 mmproj 投影器。
        2. `_init_mtmd_context(model)` attaches the projector to the text model.
           / 将投影器挂接到文本模型。
        3. `mtmd_support_vision(ctx)` reports whether the model can really see images.
           / 报告模型是否真的能"看见"图片。

        The handler class is chosen by model architecture because different VL
        families use different chat formats (Qwen uses ChatML, LLaVA uses
        USER:/ASSISTANT:).
        / 根据模型架构选择 handler 类，因为不同 VL 家族使用不同对话格式
        （Qwen 用 ChatML，LLaVA 用 USER:/ASSISTANT:）。

        Args:
            mmproj_path: Path to the mmproj projector file / mmproj投影器文件路径.

        Returns:
            The vision chat handler if vision is supported, else None.
            / 若支持视觉则返回处理器实例，否则返回 None。
        """
        try:
            # 根据基础模型架构选择正确的视觉 handler 类
            # Pick the right vision handler class based on the base model architecture
            arch = (self._model.metadata or {}).get("general.architecture", "").lower()
            handler_cls = self._select_vision_handler_cls(arch)

            # Qwen-VL 系列需要至少 1024 个图像 token 才能正确理解图像，否则图像会被
            # 压缩到 ~64 token，模型"看不见"（输出与图片无关）。
            # Qwen-VL needs >= 1024 image tokens to actually see the image; otherwise
            # the image collapses to ~64 tokens and the model cannot ground on it.
            image_min_tokens = 1024 if "qwen" in arch else -1

            handler = handler_cls(
                clip_model_path=mmproj_path,
                verbose=False,
                image_min_tokens=image_min_tokens,
            )
            handler._init_mtmd_context(self._model)
            if handler._mtmd_cpp.mtmd_support_vision(handler.mtmd_ctx):
                return handler
            logger.warning(
                "当前模型不支持视觉输入 / "
                "Current model does not support image input"
            )
            return None
        except Exception as e:
            logger.warning(f"Vision init failed / 视觉初始化失败: {e}")
            return None

    @staticmethod
    def _select_vision_handler_cls(arch: str):
        """
        Select the vision chat handler class for the given model architecture.
        / 根据模型架构选择视觉 chat handler 类。

        Qwen3.5/Qwen3-VL 需要 `Qwen35ChatHandler`（较新版本才提供），
        旧版本 llama-cpp-python 只有 `Qwen25VLChatHandler`（Qwen2.5-VL）。
        这里优先选择最匹配的 handler，缺失时优雅回退。
        / Qwen3.5/Qwen3-VL needs `Qwen35ChatHandler` (only in newer releases);
        older llama-cpp-python only ships `Qwen25VLChatHandler` (Qwen2.5-VL).
        Prefer the most specific handler, falling back gracefully when absent.

        Args:
            arch: `general.architecture` value from model metadata.
                  / 模型元数据中的 `general.architecture` 值。

        Returns:
            A vision chat handler class / 视觉 chat handler 类。
        """
        from llama_cpp.llama_chat_format import (
            Llava15ChatHandler,
            Qwen25VLChatHandler,
        )
        from llama_cpp import llama_chat_format

        def _get(name: str):
            """按名称获取 handler 类，缺失返回 None / Get handler class by name, or None."""
            return getattr(llama_chat_format, name, None)

        # 按基础模型架构精确匹配 Qwen 系列视觉 handler。
        # Qwen3.5 → Qwen35ChatHandler；Qwen3-VL → Qwen3VLChatHandler；
        # Qwen2/2.5-VL → Qwen25VLChatHandler。
        # / Match the Qwen vision handler by base model architecture.
        # Qwen3.5 → Qwen35ChatHandler; Qwen3-VL → Qwen3VLChatHandler;
        # Qwen2/2.5-VL → Qwen25VLChatHandler.
        if "qwen35" in arch:
            return _get("Qwen35ChatHandler") or Qwen25VLChatHandler
        if "qwen3" in arch:
            return _get("Qwen3VLChatHandler") or _get("Qwen35ChatHandler") or Qwen25VLChatHandler
        if "qwen2" in arch or "qwen" in arch:
            return Qwen25VLChatHandler
        # LLaVA / 其他 — USER:/ASSISTANT: 对话格式
        return Llava15ChatHandler

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        images: list[str] | None = None,
        audio: list[str] | None = None,
        video: list[str] | None = None,
        **kwargs: Any,
    ) -> InferenceResult:
        """Generate using the local GGUF model."""
        if not self._initialized:
            raise ProviderNotAvailableError(
                "Local model is not initialized",
                provider_type=self.provider_type.value,
            )

        # 首次使用时加载模型（懒加载）/ load the model on first use (lazy)
        self._ensure_model_loaded()

        # Build messages in llama-cpp format
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # Build user message (with images if multimodal)
        user_content: str | list[dict] = user_prompt

        if images and self._has_vision:
            # 多模态格式：content 是 image/text 分段列表。
            # 图片以 base64 data URL 传入（llama-cpp 的 `_load_image` 只认 data: URL，
            # Windows 的 `file://C:\...` 反斜杠路径会触发 urlopen 失败）。
            # Multimodal format: content is a list of image/text parts.
            # Images are base64 data URLs — `_load_image` only handles data: URLs;
            # Windows `file://C:\...` backslash paths break urlopen.
            content_parts: list[dict] = []
            for img_path in images:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": encode_image_to_data_url(img_path)},
                })
            content_parts.append({"type": "text", "text": user_prompt})
            user_content = content_parts
        elif images and not self._has_vision:
            # 明确报错而非静默丢弃图片 —— 静默忽略正是"生成结果与图片毫无关联"的根源。
            # Raise a clear error instead of silently dropping images — silent
            # ignoring is exactly why output was unrelated to the uploaded image.
            raise ProviderError(
                "当前本地模型不支持图片输入，无法分析上传的图片。\n"
                "The current local model does not support image input and cannot "
                "see the uploaded image(s).\n"
                "原因 / Cause: 该模型是纯文本模型（未配置可用的视觉投影器 mmproj，"
                "或其架构不支持视觉）。\n"
                "解决 / Fix: 请切换到视觉语言模型（如 Qwen2.5-VL / Qwen3-VL / LLaVA）"
                "并配置配套的 mmproj 文件；或改用支持视觉的在线 API。",
                provider_type=self.provider_type.value,
            )

        messages.append({"role": "user", "content": user_content})

        try:
            temperature = kwargs.get(
                "temperature",
                self._config.extra_params.get("temperature", 0.7) if self._config else 0.7,
            )
            top_p = kwargs.get(
                "top_p",
                self._config.extra_params.get("top_p", 0.9) if self._config else 0.9,
            )

            # 有图片时临时挂载视觉 chat handler（仅本次调用生效），
            # 文本调用仍走模型自带的 chat template handler。
            # When images are present, temporarily attach the vision chat handler
            # for this call only; text calls keep the default chat template handler.
            if images and self._has_vision and self._vision_handler is not None:
                prev_handler = self._model.chat_handler
                self._model.chat_handler = self._vision_handler
                try:
                    response = self._model.create_chat_completion(
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p,
                        max_tokens=kwargs.get("max_tokens", 4096),
                    )
                finally:
                    self._model.chat_handler = prev_handler
            else:
                response = self._model.create_chat_completion(
                    messages=messages,
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=kwargs.get("max_tokens", 4096),
                )

            choice = response["choices"][0]
            text = choice["message"]["content"]
            finish_reason = choice.get("finish_reason", "stop")
            tokens = response.get("usage", {}).get("total_tokens", 0)

            return InferenceResult(
                text=text.strip(),
                model_name=self.model_name,
                tokens_used=tokens,
                finish_reason=finish_reason,
                raw_response=response,
            )

        except Exception as e:
            raise ProviderError(
                f"Local model inference failed: {e}",
                provider_type=self.provider_type.value,
                original_error=e,
            )

    async def is_available(self) -> bool:
        """已配置即视为可用（模型延迟到首次使用时加载）/ configured = available (model loads lazily)."""
        return self._initialized and self._model_path is not None

    async def shutdown(self) -> None:
        """Unload the model and free memory."""
        if self._model is not None:
            # llama-cpp-python models are freed when the object is garbage collected
            self._model = None
            self._set_initialized(False)
            logger.info("Local model unloaded")
