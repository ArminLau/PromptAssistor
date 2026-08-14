"""
Configuration manager for PromptAssistor backend.

Loads, validates, and saves application configuration from/to JSON.
Provides default values for all settings.
"""

import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Any

from .constants import DEFAULT_CONFIG_PATH, DEFAULT_PORT, ProviderType

logger = logging.getLogger(__name__)

# Default configuration template
DEFAULT_CONFIG: dict[str, Any] = {
    "active_provider": ProviderType.ONLINE.value,
    "port": DEFAULT_PORT,
    "workspace": {
        "enabled": False,
        "path": "",
        "skills_dir": "",
        "models_dir": "",
        "output_dir": "",
    },
    "providers": {
        ProviderType.LOCAL.value: {
            "model_path": "",
            "mmproj_path": "",
            # 默认上下文长度 / Default context length.
            # 必须足够容纳: minimax_h3 skill 系统提示词(~14.5KB) + 视觉图片
            # (image_min_tokens=1024) + 用户输入。4096 太小会导致 Qwen3-VL 的
            # M-RoPE(n_pos_per_embd>1) 报 "Context Shift disabled" 错误。
            # / Must hold: minimax_h3 skill system prompt (~14.5KB) + vision image
            # (image_min_tokens=1024) + user input. 4096 is too small and triggers
            # "Context Shift disabled" under Qwen3-VL M-RoPE.
            "n_ctx": 32768,
            "n_threads": 8,
            "gpu_layers": -1,
            "temperature": 0.7,
            "top_p": 0.9,
        },
        ProviderType.ONLINE.value: {
            "provider": "deepseek",
            "api_key": "",
            "api_base": "https://api.deepseek.com/v1",
            "model_name": "deepseek-chat",
            "temperature": 0.7,
            "max_tokens": 4096,
        },
        ProviderType.OLLAMA.value: {
            "host": "http://localhost:11434",
            "model_name": "qwen3:latest",
            "temperature": 0.7,
        },
    },
    "ui": {
        "language": "zh_CN",
        "theme": "auto",
    },
    "features": {
        "reverse": {"active_model": ""},
        "expand": {"active_model": ""},
        "batch": {"active_model": ""},
    },
}


class ConfigManager:
    """
    Singleton configuration manager.

    Loads config from JSON file, falls back to defaults if file is missing or invalid.
    Provides attribute-style and dict-style access to config values.

    Usage:
        config = ConfigManager()
        port = config.get("port", DEFAULT_PORT)
        config.set("providers.online.api_key", "sk-xxx")
        config.save()
    """

    _instance: "ConfigManager | None" = None

    def __new__(cls, config_path: Path | None = None) -> "ConfigManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, config_path: Path | None = None) -> None:
        if self._initialized:
            return
        self._config_path = config_path or DEFAULT_CONFIG_PATH
        self._data: dict[str, Any] = deepcopy(DEFAULT_CONFIG)
        self._initialized = True
        self.load()

    def load(self) -> None:
        """Load configuration from file. Falls back to defaults on failure."""
        if not self._config_path.exists():
            logger.info(f"Config file not found at {self._config_path}, using defaults")
            self._ensure_data_dir()
            self.save()
            return

        try:
            with open(self._config_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            # Merge loaded config with defaults (to add any missing keys)
            self._data = self._deep_merge(deepcopy(DEFAULT_CONFIG), loaded)
            logger.info(f"Configuration loaded from {self._config_path}")
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load config: {e}, using defaults")

    def save(self) -> None:
        """Save current configuration to file."""
        self._ensure_data_dir()
        try:
            with open(self._config_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
            logger.debug(f"Configuration saved to {self._config_path}")
        except OSError as e:
            logger.error(f"Failed to save config: {e}")

    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get a config value by dot-separated path.

        Example: config.get("providers.online.api_key")
        """
        keys = key_path.split(".")
        value = self._data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
                if value is None:
                    return default
            else:
                return default
        return value

    def set(self, key_path: str, value: Any) -> None:
        """
        Set a config value by dot-separated path.

        Example: config.set("active_provider", "local")
        """
        keys = key_path.split(".")
        target = self._data
        for key in keys[:-1]:
            if key not in target:
                target[key] = {}
            target = target[key]
        target[keys[-1]] = value

    def get_provider_config(self, provider_type: str) -> dict[str, Any]:
        """Get the full configuration for a specific provider type."""
        return self.get(f"providers.{provider_type}", {})

    def get_all(self) -> dict[str, Any]:
        """Return a deep copy of the entire configuration."""
        return deepcopy(self._data)

    def reset(self) -> None:
        """Reset all configuration to defaults."""
        self._data = deepcopy(DEFAULT_CONFIG)
        self.save()

    def _ensure_data_dir(self) -> None:
        """Create the data directory if it doesn't exist."""
        self._config_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _deep_merge(base: dict, overlay: dict) -> dict:
        """Recursively merge overlay into base dict."""
        for key, value in overlay.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                base[key] = ConfigManager._deep_merge(base[key], value)
            else:
                base[key] = value
        return base
