"""
File handler utilities for PromptAssistor.

Handles file I/O, format detection, MIME type detection,
and drag-and-drop file collection.
"""

import logging
import mimetypes
from pathlib import Path
from typing import Any

from app.constants import (
    SUPPORTED_AUDIO_FORMATS,
    SUPPORTED_IMAGE_FORMATS,
    SUPPORTED_TEXT_FORMATS,
    SUPPORTED_VIDEO_FORMATS,
    MediaType,
)

logger = logging.getLogger(__name__)


def detect_media_type(file_path: str | Path) -> MediaType | None:
    """
    Detect the media type of a file based on its extension.

    Args:
        file_path: Path to the file.

    Returns:
        MediaType enum value, or None if unrecognized.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in SUPPORTED_IMAGE_FORMATS:
        return MediaType.IMAGE
    elif suffix in SUPPORTED_VIDEO_FORMATS:
        return MediaType.VIDEO
    elif suffix in SUPPORTED_AUDIO_FORMATS:
        return MediaType.AUDIO
    elif suffix in SUPPORTED_TEXT_FORMATS:
        return MediaType.TEXT
    else:
        return None


def get_mime_type(file_path: str | Path) -> str:
    """
    Get the MIME type of a file.

    Args:
        file_path: Path to the file.

    Returns:
        MIME type string (e.g., "image/png"), defaults to "application/octet-stream".
    """
    path = Path(file_path)
    mime_type, _ = mimetypes.guess_type(path.name)
    return mime_type or "application/octet-stream"


def encode_image_to_data_url(image_path: str | Path) -> str:
    """
    Encode an image file to a base64 data URL for multimodal API transmission.
    / 将图片文件编码为 base64 数据URL，用于多模态API传输。

    Args:
        image_path: Path to the image file / 图片文件路径.

    Returns:
        Base64 data URL string (e.g., "data:image/png;base64,...").
        / base64 数据URL字符串（如 "data:image/png;base64,..."）。
    """
    import base64

    path = Path(image_path)
    mime_type = get_mime_type(path)
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def collect_files(
    paths: list[str | Path],
    media_types: set[MediaType] | None = None,
) -> dict[MediaType, list[Path]]:
    """
    Collect and categorize files by media type.

    Args:
        paths: List of file paths or directory paths.
        media_types: Optional set of MediaTypes to filter by.

    Returns:
        Dictionary mapping MediaType to list of Path objects.
    """
    result: dict[MediaType, list[Path]] = {
        MediaType.IMAGE: [],
        MediaType.VIDEO: [],
        MediaType.AUDIO: [],
        MediaType.TEXT: [],
    }

    for raw_path in paths:
        path = Path(raw_path)

        if path.is_dir():
            # Recursively collect files from directory
            for file_path in path.rglob("*"):
                if file_path.is_file():
                    _categorize_file(file_path, result, media_types)
        elif path.is_file():
            _categorize_file(path, result, media_types)
        else:
            logger.warning(f"Path not found: {path}")

    return result


def read_text_file(file_path: str | Path, encoding: str = "utf-8") -> str:
    """
    Read a text file with automatic encoding detection fallback.

    Args:
        file_path: Path to the text file.
        encoding: Preferred encoding.

    Returns:
        File contents as string.
    """
    path = Path(file_path)

    try:
        return path.read_text(encoding=encoding)
    except UnicodeDecodeError:
        # Try common encodings
        for enc in ["gbk", "gb2312", "latin-1", "cp1252"]:
            try:
                return path.read_text(encoding=enc)
            except UnicodeDecodeError:
                continue
        raise ValueError(f"Cannot decode file: {file_path}")


def get_file_info(file_path: str | Path) -> dict[str, Any]:
    """
    Get metadata about a file.

    Args:
        file_path: Path to the file.

    Returns:
        Dictionary with keys: name, path, size, mime_type, media_type, extension.
    """
    path = Path(file_path)
    media_type = detect_media_type(path)

    return {
        "name": path.name,
        "path": str(path.absolute()),
        "size": path.stat().st_size if path.exists() else 0,
        "mime_type": get_mime_type(path),
        "media_type": media_type.value if media_type else "unknown",
        "extension": path.suffix.lower(),
    }


def _categorize_file(
    path: Path,
    result: dict[MediaType, list[Path]],
    media_types: set[MediaType] | None,
) -> None:
    """Categorize a single file into the result dict."""
    media_type = detect_media_type(path)
    if media_type is None:
        return
    if media_types and media_type not in media_types:
        return
    result[media_type].append(path)
