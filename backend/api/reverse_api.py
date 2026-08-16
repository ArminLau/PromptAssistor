"""
F1: Prompt Reverse Engineering API routes.
/ F1: 提示词反推 API 路由。

Endpoint for reverse-engineering prompts from images, returning per-image results.
/ 从图片反推提示词的端点，逐图返回结果。
"""

import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, Request, UploadFile

from core.engine import PromptEngine

logger = logging.getLogger(__name__)

router = APIRouter()

# 反推目标模型类型 → 显示名 / Reverse target model type → display name
REVERSE_MODEL_LABELS: dict[str, str] = {
    "krea2": "Krea 2",
    "z-image": "Z-Image",
    "flux": "FLUX.1",
    "qwen-image": "Qwen-Image",
    "anima": "Anima",
    "sdxl": "SDXL",
}

# 反推提示词风格 → 注入指令 / Reverse style → instruction injected into the system prompt
REVERSE_STYLE_INSTRUCTIONS: dict[str, str] = {
    "five_point": (
        "*** 反推提示词风格 / Reverse style: 自然语言·五点结构式 ***\n"
        "输出一段连贯的自然语言提示词，按五点结构极致还原画面："
        "构图（取景、景别、角度、镜头）、主体（人物/物体及其细节）、"
        "环境（场景、背景）、文字（画面中需渲染的文字，用引号括起）、"
        "风格（媒介、光影、色彩、质感）。适用于 Flux、Midjourney 等自然语言提示词模型。\n"
        "Output one coherent natural-language prompt organized around five points: "
        "composition, subject, environment, text, and style."
    ),
    "multi_paragraph": (
        "*** 反推提示词风格 / Reverse style: 自然语言·多段长描述 ***\n"
        "输出 2-5 段自然语言长描述，不使用 Markdown 小标题，支持角色名。"
        "内容覆盖主体、环境、光影、色彩、材质、构图等细节。\n"
        "Output 2-5 paragraphs of natural-language description, no Markdown headings, "
        "character names allowed."
    ),
    "short": (
        "*** 反推提示词风格 / Reverse style: 自然语言·短描述 ***\n"
        "输出简短扼要的短段落自然语言描述，覆盖主要对象与细节，避免冗长修辞。\n"
        "Output a brief, concise natural-language paragraph covering key subjects and details."
    ),
}


def _build_extra_context(
    skill_name: str,
    model_type: str,
    target_length: int,
    reverse_style: str,
) -> str:
    """按参数拼装注入 system prompt 的附加上下文 / Build extra context injected into the system prompt."""
    parts: list[str] = []

    # 目标模型（skill 模式下）/ target model section (skill mode)
    if skill_name and model_type:
        label = REVERSE_MODEL_LABELS.get(model_type, model_type)
        parts.append(
            f"*** 目标模型 / Target model: {label} ***\n"
            f"请严格遵循 Skill 指南中「{label}」章节的提示词规范进行反推。\n"
            f'Please strictly follow the "{label}" section in the skill guide.'
        )

    # 反推风格 / reverse style
    if reverse_style in REVERSE_STYLE_INSTRUCTIONS:
        parts.append(REVERSE_STYLE_INSTRUCTIONS[reverse_style])

    # 提示词长度 / target length
    if target_length:
        parts.append(
            f"*** 提示词长度要求（必须遵守） / Target length (mandatory): "
            f"最终输出必须达到约 {target_length} 个字符（含标点与空格），不得明显偏短。***\n"
            f"生成时请持续补充细节（构图、主体、环境、文字、风格、光影、色彩等），"
            f"并在结尾自行核对字数；若不足 {target_length} 字符，继续补充直到达标。\n"
            f"The final output MUST reach approximately {target_length} characters "
            f"(including punctuation and spaces); do not stop early."
        )

    return "\n\n".join(parts)


@router.post("")
async def reverse_prompt(
    request: Request,
    skill_name: str = Form(default=""),
    user_text: str = Form(default=""),
    images: list[UploadFile] = File(default=[]),
    model_type: str = Form(default=""),
    target_length: int = Form(default=0),
    reverse_style: str = Form(default=""),
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

    extra = _build_extra_context(skill_name, model_type, target_length, reverse_style)
    # 有 skill → 走 skill 反推；无 skill → 走完全参考反推
    # / with skill → skill-based reverse; without skill → reference-only reverse
    feature = "reverse" if skill_name else "reverse_reference"

    # 逐图反推 / reverse each image independently
    results: list[dict[str, Any]] = []
    for filename, path in image_paths:
        try:
            result = await engine.generate(
                feature=feature,
                skill_name=skill_name,
                user_text=user_text,
                images=[path],
                extra_context=extra,
            )
            results.append({
                "filename": filename,
                "result": result.text,
                "model_name": result.model_name,
                "tokens_used": result.tokens_used,
            })
        except Exception as e:
            logger.error(f"Reverse prompt failed for {filename}: {e}")
            results.append({"filename": filename, "result": "", "error": str(e)})

    return {"success": True, "results": results}
