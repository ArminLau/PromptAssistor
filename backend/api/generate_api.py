"""
F6: Prompt Generation API route — text-only generation from reference tags + requirement.
/ F6: 提示词生成 API 路由 — 由参考标签 + 需求描述纯文本生成提示词。

Mirrors the reverse feature's target parsing and context assembly, but takes no
images: the user selects a target model, optional reference tags, and a
requirement description; the engine composes a professional prompt.
/ 复用反推功能的目标解析与上下文拼装，但不接收图片：用户选择目标模型、可选参考标签与
需求描述，由引擎组合生成一条专业提示词。
"""

import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.engine import PromptEngine
from core.reverse_spec import build_extra_context, parse_reverse_target

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request bodies / 请求体 ────────────────────────────────────────────────

class GenerateTag(BaseModel):
    """选中的参考标签 / A selected reference tag."""
    name: str
    content: str


class GenerateRequest(BaseModel):
    """提示词生成请求体 / Prompt-generation request body."""
    target: str = ""                  # 生成目标 raw value / target raw value (reference / natural_prompt:krea2 / ...)
    target_length: int = 0            # 提示词长度（字符）/ target length in characters
    style: str = ""                   # 生成风格（five_point/multi_paragraph/short）/ generation style
    output_language: str = ""         # 输出语言（"zh"/"en"）/ output language
    requirement: str = ""             # 生成需求描述 / requirement description
    tags: list[GenerateTag] = []      # 选中的参考标签 / selected reference tags


def _assemble_user_text(requirement: str, tags: list[GenerateTag]) -> str:
    """拼装生成用户提示词 / Assemble the generation user prompt.

    需求描述优先级最高，参考标签作为素材融入。
    / The requirement has the highest priority; reference tags are merged as material.
    """
    parts: list[str] = []
    if requirement.strip():
        parts.append(f"## 生成需求描述（优先级最高，必须严格遵循）\n{requirement.strip()}")
    if tags:
        tag_lines = [f"- {t.name}: {t.content}" for t in tags if t.name]
        if tag_lines:
            parts.append("## 参考标签（请作为素材/要素融入生成结果）\n" + "\n".join(tag_lines))
    return "\n\n".join(parts)


@router.post("")
async def generate_prompt(request: Request, body: GenerateRequest):
    """生成提示词 / Generate a prompt.

    Args:
        request: FastAPI 请求对象 / the FastAPI request.
        body: 生成请求体 / the generation request body.

    Returns:
        {success, result, model_name, tokens_used}.
    """
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    skill, model_type = parse_reverse_target(body.target)
    extra = build_extra_context(skill, model_type, body.target_length, body.style, body.output_language)
    user_text = _assemble_user_text(body.requirement, body.tags)
    feature = "generate" if skill else "generate_reference"

    result = await engine.generate(
        feature=feature,
        skill_name=skill,
        user_text=user_text,
        extra_context=extra,
    )

    return {
        "success": True,
        "result": result.text,
        "model_name": result.model_name,
        "tokens_used": result.tokens_used,
    }
