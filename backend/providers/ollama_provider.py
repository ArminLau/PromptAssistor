"""
Ollama provider for local Ollama server connection.

Ollama is a local LLM server that supports:
- GGUF model management
- Multimodal input (images)
- OpenAI-compatible API
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


class OllamaProvider(BaseProvider):
    """
    Provider for local Ollama server.

    Requires Ollama to be installed and running locally.
    Connects via the Ollama REST API (default: http://localhost:11434).
    """

    def __init__(self) -> None:
        super().__init__()
        self._client = None  # ollama.AsyncClient instance

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.OLLAMA

    async def initialize(self, config: ProviderConfig) -> bool:
        """
        Initialize the Ollama client.

        Args:
            config: Must include api_base (Ollama host) and model_name.
        """
        self._config = config

        try:
            import ollama

            host = config.api_base or "http://localhost:11434"
            self._client = ollama.AsyncClient(host=host)

            # Verify the model is available
            try:
                models_response = await self._client.list()
                model_names = [m.get("name", "") for m in models_response.get("models", [])]
                logger.info(f"Ollama available models: {model_names}")

                if config.model_name and config.model_name not in model_names:
                    logger.warning(
                        f"Model '{config.model_name}' not found in Ollama. "
                        f"You may need to run: ollama pull {config.model_name}"
                    )
            except Exception as e:
                logger.warning(f"Could not list Ollama models: {e}")

            self._set_initialized(True)
            logger.info(f"Ollama provider initialized: {host}")
            return True

        except ImportError:
            raise ProviderInitError(
                "ollama package is not installed. Run: pip install ollama",
                provider_type=self.provider_type.value,
            )
        except Exception as e:
            raise ProviderInitError(
                f"Failed to initialize Ollama client: {e}",
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
        """Generate using Ollama."""
        if not self._client or not self._initialized:
            raise ProviderNotAvailableError(
                "Ollama provider is not initialized",
                provider_type=self.provider_type.value,
            )

        # Build messages
        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        temperature = kwargs.get(
            "temperature",
            self._config.extra_params.get("temperature", 0.7) if self._config else 0.7,
        )

        try:
            # Ollama supports images via the 'images' parameter
            response = await self._client.chat(
                model=self._config.model_name if self._config else "",
                messages=messages,
                images=images or [],  # Pass image paths directly to Ollama
                options={
                    "temperature": temperature,
                },
                stream=False,
            )

            text = response.get("message", {}).get("content", "")
            tokens = response.get("eval_count", 0)
            finish_reason = "stop" if response.get("done", False) else "error"

            return InferenceResult(
                text=text.strip(),
                model_name=self.model_name,
                tokens_used=tokens,
                finish_reason=finish_reason,
                raw_response=response,
            )

        except Exception as e:
            raise ProviderError(
                f"Ollama call failed: {e}",
                provider_type=self.provider_type.value,
                original_error=e,
            )

    async def is_available(self) -> bool:
        """Check if Ollama server is reachable."""
        if not self._client or not self._initialized:
            return False

        try:
            await self._client.list()
            return True
        except Exception:
            return False

    async def shutdown(self) -> None:
        """Close the Ollama client."""
        # Ollama client is stateless, no explicit cleanup needed
        self._client = None
        self._set_initialized(False)
        logger.info("Ollama provider closed")
