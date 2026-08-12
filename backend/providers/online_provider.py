"""
Online API LLM provider.

Supports any OpenAI-compatible API endpoint, including:
- Deepseek (api.deepseek.com)
- Kimi/Moonshot (api.moonshot.cn)
- GLM/ZhipuAI (open.bigmodel.cn)
- GPT/OpenAI (api.openai.com)
- And any other OpenAI-compatible API
"""

import logging
from typing import Any

from app.constants import ProviderType
from .base import (
    BaseProvider,
    InferenceResult,
    ProviderConfig,
    ProviderError,
    ProviderInitError,
    ProviderNotAvailableError,
)

logger = logging.getLogger(__name__)


class OnlineProvider(BaseProvider):
    """
    Provider for online LLM APIs via OpenAI-compatible protocol.

    A single class covers all OpenAI-compatible providers.
    The difference is only in api_base and api_key configuration.
    """

    def __init__(self) -> None:
        super().__init__()
        self._client = None  # openai.AsyncOpenAI instance

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.ONLINE

    async def initialize(self, config: ProviderConfig) -> bool:
        """
        Initialize the online API client.

        Args:
            config: Must include api_base, api_key, and model_name.
        """
        self._config = config

        if not config.api_base:
            raise ProviderInitError(
                "API base URL is required for online provider",
                provider_type=self.provider_type.value,
            )

        try:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=config.api_key or "not-needed",  # Some local APIs don't require a key
                base_url=config.api_base,
                timeout=120.0,  # 2 minute timeout for long generations
            )

            self._set_initialized(True)
            logger.info(
                f"Online provider initialized: {config.api_base} "
                f"(model: {config.model_name})"
            )
            return True

        except ImportError:
            raise ProviderInitError(
                "openai package is not installed. Run: pip install openai",
                provider_type=self.provider_type.value,
            )
        except Exception as e:
            raise ProviderInitError(
                f"Failed to initialize online client: {e}",
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
        """Generate using the online API."""
        if not self._client or not self._initialized:
            raise ProviderNotAvailableError(
                "Online provider is not initialized",
                provider_type=self.provider_type.value,
            )

        # Build messages
        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
        ]

        # Build user message content
        user_content: str | list[dict] = user_prompt

        if images:
            # OpenAI Vision API format
            content_parts: list[dict] = []
            for img_path in images:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": self._encode_image(img_path),
                        "detail": "high",
                    },
                })
            content_parts.append({"type": "text", "text": user_prompt})
            user_content = content_parts

        messages.append({"role": "user", "content": user_content})

        try:
            temperature = kwargs.get(
                "temperature",
                self._config.extra_params.get("temperature", 0.7) if self._config else 0.7,
            )
            max_tokens = kwargs.get(
                "max_tokens",
                self._config.extra_params.get("max_tokens", 4096) if self._config else 4096,
            )

            response = await self._client.chat.completions.create(
                model=self._config.model_name if self._config else "",
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            choice = response.choices[0]
            text = choice.message.content or ""
            finish_reason = choice.finish_reason or "stop"
            tokens = response.usage.total_tokens if response.usage else 0

            return InferenceResult(
                text=text.strip(),
                model_name=self.model_name,
                tokens_used=tokens,
                finish_reason=finish_reason,
                raw_response=response.model_dump() if hasattr(response, "model_dump") else None,
            )

        except Exception as e:
            raise ProviderError(
                f"Online API call failed: {e}",
                provider_type=self.provider_type.value,
                original_error=e,
            )

    async def is_available(self) -> bool:
        """Test connectivity by listing models."""
        if not self._client or not self._initialized:
            return False

        try:
            await self._client.models.list()
            return True
        except Exception:
            return False

    async def shutdown(self) -> None:
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.close()
            self._client = None
            self._set_initialized(False)
            logger.info("Online provider client closed")

    @staticmethod
    def _encode_image(image_path: str) -> str:
        """
        Encode an image file to base64 data URL for API transmission.

        Args:
            image_path: Path to the image file.

        Returns:
            Base64 data URL string (e.g., "data:image/png;base64,...").
        """
        import base64
        import mimetypes
        from pathlib import Path

        path = Path(image_path)
        mime_type = mimetypes.guess_type(path.name)[0] or "image/png"

        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")

        return f"data:{mime_type};base64,{encoded}"
