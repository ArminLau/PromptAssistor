"""
Model manager for PromptAssistor.

Manages the lifecycle of LLM providers: initialization, switching,
and providing the active provider for inference requests.
"""

import asyncio
import logging
from typing import Any

from app.config import ConfigManager
from app.constants import ProviderType
from providers.base import (
    BaseProvider,
    ProviderConfig,
    ProviderError,
    ProviderNotAvailableError,
)

logger = logging.getLogger(__name__)


class ModelManager:
    """
    Singleton manager for LLM provider lifecycle.

    Responsibilities:
    - Create and initialize providers based on configuration
    - Track the active provider for the application
    - Support hot-switching between providers
    - Handle per-feature model preferences

    Usage:
        manager = ModelManager()
        await manager.initialize()
        provider = manager.get_active_provider()
        result = await provider.generate(...)
    """

    _instance: "ModelManager | None" = None

    def __new__(cls) -> "ModelManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._config = ConfigManager()
        self._providers: dict[str, BaseProvider] = {}
        self._active_provider_type: str | None = None
        self._feature_models: dict[str, str] = {}  # feature_id → skill_name
        self._lock = asyncio.Lock()
        self._initialized = True

    async def initialize(self) -> None:
        """
        Initialize the model manager.

        Loads the active provider from config and initializes it.
        If the configured provider fails, falls back to others in order:
        online → ollama → local.
        / 从配置加载活跃后端并初始化。若失败则依次回退: online → ollama → local。
        Called once at application startup.
        """
        active = self._config.get("active_provider", ProviderType.ONLINE.value)

        # 防止无效的 provider 类型（如 "workspace"）导致静默失败
        # Guard against invalid provider types (e.g. "workspace") causing silent failure
        valid_types = {pt.value for pt in ProviderType}
        if active not in valid_types:
            logger.warning(
                f"Invalid active_provider in config / 配置中的active_provider无效: '{active}'. "
                f"Falling back to 'online' / 回退到 'online'."
            )
            active = ProviderType.ONLINE.value

        logger.info(f"Initializing model manager with active provider: {active}")
        success = await self._switch_provider(active)

        # 即使配置的后端初始化成功，也要验证其是否实际可用
        # Even if the configured provider initializes, verify it is actually available
        if success:
            provider = self._providers.get(active)
            if provider and not await provider.is_available():
                logger.warning(
                    f"Configured provider '{active}' initialized but not available / "
                    f"配置的后端 '{active}' 已初始化但不可用."
                )
                await self._deactivate_provider(active)
                success = False

        # 如果配置的后端初始化失败或不可用，依次尝试其他后端作为回退
        # If the configured provider fails or is unavailable, try fallback chain
        if not success:
            fallback_order = [
                pt.value for pt in ProviderType
                if pt.value != active
            ]
            fallback_succeeded = False
            for fallback in fallback_order:
                logger.warning(
                    f"Provider '{active}' failed, trying fallback: '{fallback}' / "
                    f"后端 '{active}' 失败，尝试回退: '{fallback}'"
                )
                if await self._switch_provider(fallback):
                    # 验证回退后端是否实际可用（不只是初始化成功）
                    # Verify fallback is actually available (not just initialized)
                    provider = self._providers.get(fallback)
                    if provider and await provider.is_available():
                        # 回退成功且可用，更新配置 / Fallback succeeded and is usable
                        self._config.set("active_provider", fallback)
                        self._config.save()
                        logger.info(
                            f"Fallback to '{fallback}' succeeded, config updated / "
                            f"回退到 '{fallback}' 成功，配置已更新"
                        )
                        fallback_succeeded = True
                        break
                    else:
                        # 回退不可用 → 清理内存状态，避免污染 _active_provider_type
                        # Unavailable fallback → clean up in-memory state to avoid polluting
                        logger.warning(
                            f"Fallback '{fallback}' initialized but not available / "
                            f"回退 '{fallback}' 已初始化但不可用. "
                            f"Config NOT updated — keeping original preference / "
                            f"配置未更新 — 保留原始偏好 '{active}'."
                        )
                        await self._deactivate_provider(fallback)

            if not fallback_succeeded:
                # 无任何可用后端 → 确保无活跃后端状态（避免残留错误状态）
                # No available provider → ensure clean state (avoid stale state)
                self._active_provider_type = None
                logger.error(
                    "All providers failed to initialize / 所有后端初始化失败. "
                    "App will run without an active provider / 应用将在无活跃后端的情况下运行."
                )

    async def get_active_provider(self) -> BaseProvider:
        """
        Get the currently active LLM provider.

        Returns:
            The active BaseProvider instance.

        Raises:
            ProviderNotAvailableError: If no provider is active or available.
        """
        if self._active_provider_type is None:
            raise ProviderNotAvailableError("No active provider configured")

        provider = self._providers.get(self._active_provider_type)
        if provider is None:
            raise ProviderNotAvailableError(
                f"Active provider '{self._active_provider_type}' not found"
            )

        if not await provider.is_available():
            raise ProviderNotAvailableError(
                f"Provider '{self._active_provider_type}' is not available"
            )

        return provider

    async def switch_provider(self, provider_type: str) -> bool:
        """
        Switch the active provider to a different type.

        Args:
            provider_type: The provider type to switch to ("local", "online", "ollama").

        Returns:
            True if the switch was successful.

        Raises:
            ProviderError: If the new provider fails to initialize.
        """
        async with self._lock:
            result = await self._switch_provider(provider_type)
            if result:
                self._config.set("active_provider", provider_type)
                self._config.save()
                logger.info(f"Switched active provider to: {provider_type}")
            return result

    async def test_provider(self, provider_type: str) -> dict[str, Any]:
        """
        Test if a provider can be initialized and is available.

        Args:
            provider_type: The provider type to test.

        Returns:
            Dict with keys: success (bool), message (str).
        """
        try:
            provider = await self._create_provider(provider_type)
            if provider is None:
                return {"success": False, "message": f"Unknown provider type: {provider_type}"}

            # 触发懒加载以真实验证后端可用（如本地模型需真正加载）
            # / trigger lazy-load to actually verify the provider (e.g. load the local model)
            await provider.ensure_ready()
            is_available = await provider.is_available()
            await provider.shutdown()

            if is_available:
                return {"success": True, "message": f"Provider '{provider_type}' is available"}
            else:
                return {"success": False, "message": f"Provider '{provider_type}' is not available"}
        except ProviderError as e:
            return {"success": False, "message": str(e)}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {e}"}

    def get_active_provider_info(self) -> dict[str, Any]:
        """Get information about the currently active provider for the UI."""
        if self._active_provider_type is None:
            return {"active": None, "available": []}

        provider = self._providers.get(self._active_provider_type)
        return {
            "active": {
                "type": self._active_provider_type,
                "model_name": provider.model_name if provider else "",
            },
            "available": list(self._providers.keys()),
        }

    def set_feature_model(self, feature_id: str, skill_name: str) -> None:
        """
        Set which model/skill a feature should use.

        Features 1-3 can each independently select their model.
        Feature 4 (prompt library) does not use this.

        Args:
            feature_id: Identifier for the feature (e.g., "reverse", "expand", "batch").
            skill_name: The skill name to use (e.g., "minimax_h3").
        """
        self._feature_models[feature_id] = skill_name
        self._config.set(f"features.{feature_id}.active_model", skill_name)
        self._config.save()

    def get_feature_model(self, feature_id: str) -> str:
        """
        Get which model/skill a feature is configured to use.

        Args:
            feature_id: Identifier for the feature.

        Returns:
            The skill name, or empty string if not set.
        """
        return self._feature_models.get(
            feature_id,
            self._config.get(f"features.{feature_id}.active_model", ""),
        )

    async def shutdown(self) -> None:
        """Shutdown all providers and release resources."""
        logger.info("Shutting down model manager...")
        for provider_type, provider in self._providers.items():
            try:
                await provider.shutdown()
                logger.debug(f"Shutdown provider: {provider_type}")
            except Exception as e:
                logger.warning(f"Error shutting down provider {provider_type}: {e}")
        self._providers.clear()
        self._active_provider_type = None

    async def _deactivate_provider(self, provider_type: str) -> None:
        """
        Shutdown and remove a provider that is not actually available.
        / 关闭并移除一个实际不可用的后端。

        用于回退链中清理初始化成功但 is_available() 为 False 的后端，
        避免 _active_provider_type 和 _providers 残留错误状态。
        / Used to clean up providers that initialized but are not available,
        preventing stale state in _active_provider_type and _providers.
        """
        provider = self._providers.pop(provider_type, None)
        if provider is not None:
            try:
                await provider.shutdown()
            except Exception as e:
                logger.warning(f"Error shutting down provider / 关闭后端异常: {e}")
        if self._active_provider_type == provider_type:
            self._active_provider_type = None

    async def _switch_provider(self, provider_type: str) -> bool:
        """
        Internal method to switch providers without locking.

        先创建新后端，成功后再关闭旧后端。如果新后端初始化失败，保持旧后端不变。
        / Create new provider first, only shutdown old one on success.
        If new provider init fails, keep the old provider active.
        """
        # Create and initialize new provider FIRST / 先创建并初始化新后端
        try:
            provider = await self._create_provider(provider_type)
        except ProviderError as e:
            # 新后端初始化失败（缺少依赖包等），保持旧后端不变
            # New provider init failed (missing deps, etc.), keep old provider active
            logger.warning(
                f"Provider '{provider_type}' init failed / "
                f"后端 '{provider_type}' 初始化失败: {e}"
            )
            return False

        if provider is None:
            logger.error(f"Unknown provider type / 未知后端类型: {provider_type}")
            return False

        # Shutdown old provider only after new one is confirmed working
        # / 确认新后端可用后再关闭旧后端
        if self._active_provider_type and self._active_provider_type in self._providers:
            old = self._providers[self._active_provider_type]
            if old is not None:
                try:
                    await old.shutdown()
                except Exception as e:
                    logger.warning(f"Error shutting down old provider / 关闭旧后端异常: {e}")

        self._providers[provider_type] = provider
        self._active_provider_type = provider_type
        return True

    async def _create_provider(self, provider_type: str) -> BaseProvider | None:
        """Create and initialize a provider based on type string."""
        provider_config = self._config.get_provider_config(provider_type)

        if provider_type == ProviderType.LOCAL.value:
            from providers.local_provider import LocalProvider
            config = ProviderConfig(
                provider_type=provider_type,
                model_path=provider_config.get("model_path", ""),
                mmproj_path=provider_config.get("mmproj_path", ""),
                model_name=provider_config.get("model_name", "Local Model"),
                extra_params={
                    "n_ctx": provider_config.get("n_ctx", 32768),
                    "n_threads": provider_config.get("n_threads", 8),
                    "gpu_layers": provider_config.get("gpu_layers", -1),
                    "temperature": provider_config.get("temperature", 0.7),
                    "top_p": provider_config.get("top_p", 0.9),
                },
            )
            provider = LocalProvider()

        elif provider_type == ProviderType.ONLINE.value:
            from providers.online_provider import OnlineProvider
            config = ProviderConfig(
                provider_type=provider_type,
                api_base=provider_config.get("api_base", ""),
                api_key=provider_config.get("api_key", ""),
                model_name=provider_config.get("model_name", ""),
                extra_params={
                    "temperature": provider_config.get("temperature", 0.7),
                    "max_tokens": provider_config.get("max_tokens", 4096),
                },
            )
            provider = OnlineProvider()

        elif provider_type == ProviderType.OLLAMA.value:
            from providers.ollama_provider import OllamaProvider
            config = ProviderConfig(
                provider_type=provider_type,
                api_base=provider_config.get("host", "http://localhost:11434"),
                model_name=provider_config.get("model_name", ""),
                extra_params={
                    "temperature": provider_config.get("temperature", 0.7),
                },
            )
            provider = OllamaProvider()

        else:
            return None

        await provider.initialize(config)
        return provider
