"""
F1: Prompt Reverse Engineering API routes.

Endpoint for reverse-engineering prompts from images/videos.
"""

import logging
from typing import Any

from fastapi import APIRouter, File, Form, Request, UploadFile

from core.engine import PromptEngine

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("")
async def reverse_prompt(
    request: Request,
    skill_name: str = Form(...),
    user_text: str = Form(default=""),
    images: list[UploadFile] = File(default=[]),
    extra_context: str = Form(default=""),
):
    """
    Reverse-engineer a prompt from uploaded images/video.

    Args:
        skill_name: Name of the skill to use (e.g., "minimax_h3").
        user_text: Optional additional text instructions.
        images: Media files to analyze.
        extra_context: Additional context for the generation.

    Returns:
        Generated prompt result.
    """
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    # Save uploaded files to temp directory
    import tempfile
    from pathlib import Path

    temp_dir = Path(tempfile.mkdtemp())
    image_paths: list[str] = []

    for img in images:
        if img.filename:
            file_path = temp_dir / img.filename
            content = await img.read()
            file_path.write_bytes(content)
            image_paths.append(str(file_path))

    try:
        result = await engine.generate(
            feature="reverse",
            skill_name=skill_name,
            user_text=user_text,
            images=image_paths if image_paths else None,
            extra_context=extra_context,
        )
        return {
            "success": True,
            "result": result.text,
            "model_name": result.model_name,
            "tokens_used": result.tokens_used,
        }
    except Exception as e:
        logger.error(f"Reverse prompt failed: {e}")
        return {"success": False, "error": str(e)}
