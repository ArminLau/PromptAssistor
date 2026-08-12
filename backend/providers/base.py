"""
Abstract base class for all LLM providers.

Defines the contract that every provider must implement.
Features depend on this interface, not on concrete implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.constants import ProviderType


@dataclass
class Message:
    """A single message in a conversation with the LLM."""

    role: str  # "system", "user", "assistant"
    content: str | list[dict[str, Any]]  # str for text, list for multimodal parts


@dataclass
class InferenceResult:
    """Result returned by a provider after generation."""

    text: str
    model_name: str = ""
    tokens_used: int = 0
    finish_reason: str = "stop"  # "stop", "length", "error"
    raw_response: Any = None


@dataclass
class ProviderConfig:
    """Configuration for initializing a provider."""

    provider_type: str
    model_name: str = ""
    model_path: str = ""
    api_base: str = ""
    api_key: str = ""
    mmproj_path: str = ""
    extra_params: dict[str, Any] = field(default_factory=dict)


class ProviderError(Exception):
    """Base exception for all provider-related errors."""

    def __init__(self, message: str, provider_type: str = "", original_error: Exception | None = None):
        self.provider_type = provider_type
        self.original_error = original_error
        super().__init__(message)


class ProviderNotAvailableError(ProviderError):
    """Raised when a provider is not ready or unavailable."""
    pass


class ProviderInitError(ProviderError):
    """Raised when a provider fails to initialize."""
    pass


class BaseProvider(ABC):
    """
    Abstract base class for all LLM providers.

    Each concrete provider (local, online, ollama) implements this interface.
    Features interact with providers ONLY through this interface.

    Lifecycle:
        1. initialize(config) — set up the provider
        2. generate(...) — make inference calls (can be called multiple times)
        3. shutdown() — clean up resources
    """

    def __init__(self) -> None:
        self._config: ProviderConfig | None = None
        self._initialized: bool = False

    @abstractmethod
    async def initialize(self, config: ProviderConfig) -> bool:
        """
        Initialize the provider with the given configuration.

        Args:
            config: Provider-specific configuration.

        Returns:
            True if initialization was successful, False otherwise.

        Raises:
            ProviderInitError: If initialization fails critically.
        """
        ...

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        images: list[str] | None = None,
        audio: list[str] | None = None,
        video: list[str] | None = None,
        **kwargs: Any,
    ) -> InferenceResult:
        """
        Generate a response from the LLM.

        Args:
            system_prompt: System instruction for the model.
            user_prompt: User's input text.
            images: List of file paths to images for multimodal input.
            audio: List of file paths to audio files for multimodal input.
            video: List of file paths to video files for multimodal input.
            **kwargs: Additional provider-specific parameters.

        Returns:
            InferenceResult containing the generated text and metadata.

        Raises:
            ProviderNotAvailableError: If the provider is not ready.
            ProviderError: For other provider-specific errors.
        """
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if the provider is ready to serve requests.

        Returns:
            True if the provider can accept generate() calls.
        """
        ...

    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        """Return the type enum of this provider."""
        ...

    @property
    def model_name(self) -> str:
        """Return the model name this provider is configured with."""
        return self._config.model_name if self._config else ""

    @property
    def is_initialized(self) -> bool:
        """Return whether the provider has been successfully initialized."""
        return self._initialized

    @abstractmethod
    async def shutdown(self) -> None:
        """
        Release all resources held by this provider.

        Should be idempotent — safe to call multiple times.
        """
        ...

    def _set_initialized(self, value: bool) -> None:
        """Internal helper to set initialization state."""
        self._initialized = value
