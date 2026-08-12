"""
Input validation utilities for PromptAssistor backend.
"""

import logging
from pathlib import Path
from typing import Any

from app.constants import MAX_UPLOAD_SIZE

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


def validate_required(value: Any, field_name: str) -> None:
    """Validate that a required field is not None or empty."""
    if value is None:
        raise ValidationError(f"'{field_name}' is required")
    if isinstance(value, (str, list, dict)) and len(value) == 0:
        raise ValidationError(f"'{field_name}' cannot be empty")


def validate_file_exists(file_path: str | Path) -> Path:
    """
    Validate that a file exists and return its Path.

    Args:
        file_path: Path to the file.

    Returns:
        Path object.

    Raises:
        ValidationError: If the file doesn't exist.
    """
    path = Path(file_path)
    if not path.exists():
        raise ValidationError(f"File not found: {file_path}")
    if not path.is_file():
        raise ValidationError(f"Not a file: {file_path}")
    return path


def validate_file_size(file_path: str | Path, max_size: int = MAX_UPLOAD_SIZE) -> None:
    """
    Validate that a file does not exceed the maximum size.

    Args:
        file_path: Path to the file.
        max_size: Maximum file size in bytes (default: 500MB).

    Raises:
        ValidationError: If the file exceeds max_size.
    """
    path = Path(file_path)
    size = path.stat().st_size
    if size > max_size:
        size_mb = size / (1024 * 1024)
        max_mb = max_size / (1024 * 1024)
        raise ValidationError(
            f"File '{path.name}' is {size_mb:.1f}MB, exceeds maximum of {max_mb:.0f}MB"
        )


def validate_string_length(
    value: str,
    field_name: str,
    min_length: int = 0,
    max_length: int | None = None,
) -> None:
    """
    Validate string length constraints.

    Args:
        value: The string to validate.
        field_name: Name of the field for error messages.
        min_length: Minimum allowed length.
        max_length: Maximum allowed length (None = no limit).

    Raises:
        ValidationError: If length constraints are violated.
    """
    if len(value) < min_length:
        raise ValidationError(
            f"'{field_name}' must be at least {min_length} characters"
        )
    if max_length is not None and len(value) > max_length:
        raise ValidationError(
            f"'{field_name}' must be at most {max_length} characters"
        )
