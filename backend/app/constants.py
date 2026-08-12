"""
Application-wide constants for PromptAssistor backend.
/ PromptAssistor后端应用常量定义。

Supports two modes / 支持两种模式:
- Source mode: paths derived from this file's location / 路径从本文件位置推导
- Frozen mode (PyInstaller): paths from env vars set by run.py / 路径来自run.py设置的env
"""

import os
import sys
from enum import Enum
from pathlib import Path

IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    # ─── Frozen exe mode (PyInstaller self-contained) ─────────────────
    # 自包含exe模式 / Self-contained exe mode
    # Paths are set by backend/run.py via environment variables
    # / 路径由backend/run.py通过环境变量设置

    _MEIPASS = Path(sys._MEIPASS)
    _EXE_DIR = Path(sys.executable).resolve().parent

    PROJECT_ROOT = _EXE_DIR
    BACKEND_ROOT = _MEIPASS  # backend code is in the PYZ archive

    DATA_DIR = Path(os.environ.get("PROMPTASSISTOR_DATA_DIR", str(_EXE_DIR / "data")))
    DEFAULT_SKILLS_DIR = Path(os.environ.get("PROMPTASSISTOR_SKILLS_DIR", str(_MEIPASS / "skills")))
    DEFAULT_MODELS_DIR = Path(os.environ.get("PROMPTASSISTOR_MODELS_DIR", str(_EXE_DIR / "models")))
    DEFAULT_OUTPUT_DIR = _EXE_DIR / "output"

    # Static files are embedded / 静态文件嵌入在exe中
    DEFAULT_STATIC_DIR = Path(os.environ.get("PROMPTASSISTOR_STATIC_DIR", str(_MEIPASS / "static")))

else:
    # ─── Source mode (development) ────────────────────────────────────
    # 源码模式 / Source mode

    # Project root (2 levels up from this file: backend/app/ → backend/ → root/)
    PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

    # Backend root directory
    BACKEND_ROOT = Path(__file__).resolve().parent.parent

    # Data directory for runtime files
    DATA_DIR = BACKEND_ROOT / "data"

    # Default skills directory (inside project)
    DEFAULT_SKILLS_DIR = PROJECT_ROOT / "skills"

    # Default models directory (inside project)
    DEFAULT_MODELS_DIR = PROJECT_ROOT / "models"

    # Default output directory
    DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output"

    # Static files directory (frontend build output)
    DEFAULT_STATIC_DIR = BACKEND_ROOT / "static"

# Default config file path / 默认配置文件路径
DEFAULT_CONFIG_PATH = DATA_DIR / "config.json"

# Default database path / 默认数据库路径
DEFAULT_DB_PATH = DATA_DIR / "prompts.db"

# Default log file path / 默认日志文件路径
DEFAULT_LOG_PATH = DATA_DIR / "app.log"

# Default server port / 默认服务器端口
DEFAULT_PORT = 18720

# API version prefix / API版本前缀
API_PREFIX = "/api/v1"

# ─── Workspace Resolution ────────────────────────────────────────────────
# These are MUTABLE — set by workspace_manager after config loads
# / 以下变量在工作空间加载后会被更新

SKILLS_DIR: Path = DEFAULT_SKILLS_DIR
MODELS_DIR: Path = DEFAULT_MODELS_DIR
OUTPUT_DIR: Path = DEFAULT_OUTPUT_DIR


def is_workspace_enabled() -> bool:
    """检查是否启用了工作空间 / Check if workspace is enabled."""
    # Compare with default path — if different, workspace is active
    # / 与默认路径比较 — 不同则表示工作空间已启用
    return str(SKILLS_DIR) != str(DEFAULT_SKILLS_DIR)


# ─── Enums ────────────────────────────────────────────────────────────────

class ProviderType(str, Enum):
    """Type of LLM provider backend. / LLM后端类型."""
    LOCAL = "local"       # 本地GGUF模型
    ONLINE = "online"     # 在线API
    OLLAMA = "ollama"     # 本地Ollama服务


class MediaType(str, Enum):
    """Supported media types for multimodal input. / 支持的多模态输入类型."""
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    TEXT = "text"


class PromptSourceType(str, Enum):
    """Source of a prompt in the library. / 提示词来源类型."""
    REVERSE = "reverse"   # 反推
    EXPAND = "expand"     # 扩写
    MANUAL = "manual"     # 手动
    BATCH = "batch"       # 批量


class SkillType(str, Enum):
    """Type of generation the skill is for. / Skill的生成类型."""
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"


class SystemStatus(str, Enum):
    """System check status. / 系统检查状态."""
    OK = "ok"
    WARNING = "warning"
    ERROR = "error"


# ─── File Format Support ──────────────────────────────────────────────────

# Supported image formats / 支持的图片格式
SUPPORTED_IMAGE_FORMATS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}

# Supported video formats / 支持的视频格式
SUPPORTED_VIDEO_FORMATS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}

# Supported audio formats / 支持的音频格式
SUPPORTED_AUDIO_FORMATS = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}

# Supported text formats / 支持的文本格式
SUPPORTED_TEXT_FORMATS = {".txt", ".md", ".json", ".csv", ".yaml", ".yml"}

# Maximum file upload size (500MB) / 最大文件上传大小
MAX_UPLOAD_SIZE = 500 * 1024 * 1024

# Minimal Python version required / 最低Python版本要求
MIN_PYTHON_VERSION = (3, 11)
