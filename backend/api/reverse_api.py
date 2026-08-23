"""
F1: Prompt Reverse Engineering API routes.
/ F1: 提示词反推 API 路由。

Endpoint for reverse-engineering prompts from images, returning per-image results.
/ 从图片反推提示词的端点，逐图返回结果。
"""

import json
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse

from core.engine import PromptEngine
from core.reverse_spec import build_extra_context

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("")
async def reverse_prompt(
    request: Request,
    skill_name: str = Form(default=""),
    user_text: str = Form(default=""),
    images: list[UploadFile] = File(default=[]),
    model_type: str = Form(default=""),
    target_length: int = Form(default=0),
    reverse_style: str = Form(default=""),
    output_language: str = Form(default=""),
):
    """
    Reverse-engineer a prompt from uploaded images, one result per image.
    / 从上传的图片反推提示词，逐图返回一个结果。

    Args:
        skill_name: 目标 skill（空 = 完全参考模式）/ target skill (empty = reference-only).
        user_text: 反推需求描述（优先级最高）/ requirement description (highest priority).
        images: 待分析的图片文件 / image files to analyze.
        model_type: 模型类型（krea2/z-image/flux/qwen-image/anima/sdxl）.
        target_length: 提示词长度(字符) / target length in characters.
        reverse_style: 反推风格（five_point/multi_paragraph/short）.

    Returns:
        逐图结果 / per-image results.
    """
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    # 保存上传文件到临时目录 / save uploaded files to temp dir
    temp_dir = Path(tempfile.mkdtemp())
    image_paths: list[tuple[str, str]] = []  # (filename, path)
    for img in images:
        if img.filename:
            file_path = temp_dir / img.filename
            content = await img.read()
            file_path.write_bytes(content)
            image_paths.append((img.filename, str(file_path)))

    extra = build_extra_context(skill_name, model_type, target_length, reverse_style, output_language)
    # 有 skill → 走 skill 反推；无 skill → 走完全参考反推
    # / with skill → skill-based reverse; without skill → reference-only reverse
    feature = "reverse" if skill_name else "reverse_reference"

    async def stream_results():
        """逐图反推并即时产出结果 / Reverse each image and yield its result immediately.

        每张图完成即推送一行 NDJSON，前端可增量渲染，无需等全部图片处理完。
        / Each completed image pushes one NDJSON line, so the frontend renders
        incrementally without waiting for all images to finish.
        """
        for filename, path in image_paths:
            try:
                result = await engine.generate(
                    feature=feature,
                    skill_name=skill_name,
                    user_text=user_text,
                    images=[path],
                    extra_context=extra,
                )
                payload = {
                    "filename": filename,
                    "result": result.text,
                    "model_name": result.model_name,
                    "tokens_used": result.tokens_used,
                }
            except Exception as e:
                logger.error(f"Reverse prompt failed for {filename}: {e}")
                payload = {"filename": filename, "result": "", "error": str(e)}
            # 立即产出该图结果 / yield this image's result as soon as it's ready
            yield json.dumps(payload, ensure_ascii=False) + "\n"

    return StreamingResponse(
        stream_results(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用代理缓冲，确保逐条即时推送 / disable proxy buffering
        },
    )
