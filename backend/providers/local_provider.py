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
        self._has_vision = False

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.LOCAL

    async def initialize(self, config: ProviderConfig) -> bool:
        """
        Initialize the local GGUF model.

        Args:
            config: Must include model_path. Optionally mmproj_path for vision.

        Returns:
            True if model loaded successfully.
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

        try:
            # 在 import llama_cpp 之前准备好 CUDA DLL 搜索路径（否则 ggml-cuda.dll 加载失败）
            # Prepare CUDA DLL search path before importing llama_cpp (else ggml-cuda.dll fails)
            setup_cuda_dll_search()
            from llama_cpp import Llama

            # Build kwargs for Llama constructor
            kwargs: dict[str, Any] = {
                "model_path": str(model_path),
                "n_ctx": config.extra_params.get("n_ctx", 4096),
                "n_threads": config.extra_params.get("n_threads", 8),
                "verbose": False,
            }

            # GPU acceleration
            gpu_layers = config.extra_params.get("gpu_layers", 0)
            if gpu_layers != 0:
                kwargs["n_gpu_layers"] = gpu_layers

            # Multimodal support / 多模态投影器支持
            if config.mmproj_path:
                mmproj_path = _resolve_model_path(config.mmproj_path)
                if mmproj_path.exists():
                    kwargs["mmproj_path"] = str(mmproj_path)
                    self._has_vision = True
                    logger.info(f"Vision support / 视觉支持: {mmproj_path}")
                else:
                    logger.warning(f"mmproj file not found / 投影器未找到: {mmproj_path}")

            # Load model (this is blocking — in production, run in thread pool)
            self._model = Llama(**kwargs)
            self._set_initialized(True)
            logger.info(f"Local model loaded: {model_path.name} (n_ctx={kwargs['n_ctx']})")
            return True

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
        if not self._model or not self._initialized:
            raise ProviderNotAvailableError(
                "Local model is not initialized",
                provider_type=self.provider_type.value,
            )

        # Build messages in llama-cpp format
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # Build user message (with images if multimodal)
        user_content: str | list[dict] = user_prompt

        if images and self._has_vision:
            # Multimodal format: content is a list of parts
            content_parts: list[dict] = []
            for img_path in images:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"file://{img_path}"},
                })
            content_parts.append({"type": "text", "text": user_prompt})
            user_content = content_parts
        elif images and not self._has_vision:
            logger.warning(
                "Images provided but no mmproj configured. "
                "Images will be ignored. Model is text-only."
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
        """Check if the model is loaded and ready."""
        return self._initialized and self._model is not None

    async def shutdown(self) -> None:
        """Unload the model and free memory."""
        if self._model is not None:
            # llama-cpp-python models are freed when the object is garbage collected
            self._model = None
            self._set_initialized(False)
            logger.info("Local model unloaded")
