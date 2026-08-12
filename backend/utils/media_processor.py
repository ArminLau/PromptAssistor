"""
Media processing utilities for PromptAssistor.

Handles image, audio, and video preprocessing before sending to LLMs.
"""

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def preprocess_images(
    image_paths: list[str],
    max_dimension: int = 2048,
    quality: int = 85,
) -> list[str]:
    """
    Preprocess images for LLM input.

    - Resize large images to reduce API costs
    - Verify image integrity
    - Returns list of valid image paths

    Args:
        image_paths: List of image file paths.
        max_dimension: Maximum width or height in pixels.
        quality: JPEG quality for resized images (1-100).

    Returns:
        List of processed image paths.
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed, skipping image preprocessing")
        return image_paths

    processed: list[str] = []

    for img_path in image_paths:
        try:
            img = Image.open(img_path)
            # Resize if image is too large
            if max(img.size) > max_dimension:
                ratio = max_dimension / max(img.size)
                new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

                # Save to temp file
                temp_path = Path(img_path).with_suffix(".processed.jpg")
                img.convert("RGB").save(temp_path, "JPEG", quality=quality)
                processed.append(str(temp_path))
                logger.debug(f"Resized image: {img_path} → {new_size}")
            else:
                processed.append(img_path)

        except Exception as e:
            logger.warning(f"Failed to process image {img_path}: {e}")
            # Still include original path
            processed.append(img_path)

    return processed


def extract_video_frames(
    video_path: str,
    max_frames: int = 5,
    output_dir: str | None = None,
) -> list[str]:
    """
    Extract key frames from a video for analysis.

    Args:
        video_path: Path to the video file.
        max_frames: Maximum number of frames to extract.
        output_dir: Directory to save extracted frames.

    Returns:
        List of paths to extracted frame images.
    """
    try:
        import cv2
    except ImportError:
        logger.warning("opencv-python not installed, cannot extract video frames")
        return []

    video_path = Path(video_path)
    if output_dir is None:
        output_dir = video_path.parent / f"{video_path.stem}_frames"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frames: list[str] = []
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        logger.error(f"Cannot open video: {video_path}")
        return frames

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= max_frames:
        # Extract all frames
        frame_indices = list(range(total_frames))
    else:
        # Extract evenly spaced frames
        step = total_frames / (max_frames + 1)
        frame_indices = [int(step * (i + 1)) for i in range(max_frames)]

    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            frame_path = output_dir / f"frame_{idx:04d}.jpg"
            cv2.imwrite(str(frame_path), frame)
            frames.append(str(frame_path))

    cap.release()
    logger.debug(f"Extracted {len(frames)} frames from {video_path.name}")
    return frames


def get_media_metadata(file_path: str) -> dict[str, Any]:
    """
    Get metadata for a media file (image, video, audio).

    Args:
        file_path: Path to the media file.

    Returns:
        Dictionary with media metadata.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()
    metadata: dict[str, Any] = {
        "file_name": path.name,
        "file_size": path.stat().st_size if path.exists() else 0,
        "extension": suffix,
    }

    # Image metadata
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}:
        try:
            from PIL import Image
            with Image.open(path) as img:
                metadata["width"] = img.width
                metadata["height"] = img.height
                metadata["mode"] = img.mode
        except Exception:
            pass

    # Video metadata
    elif suffix in {".mp4", ".mov", ".avi", ".webm", ".mkv"}:
        try:
            import cv2
            cap = cv2.VideoCapture(str(path))
            if cap.isOpened():
                metadata["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                metadata["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                metadata["fps"] = cap.get(cv2.CAP_PROP_FPS)
                metadata["frame_count"] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                metadata["duration_seconds"] = (
                    metadata["frame_count"] / metadata["fps"]
                    if metadata.get("fps", 0) > 0
                    else 0
                )
                cap.release()
        except Exception:
            pass

    return metadata
