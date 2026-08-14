"""
F2: Prompt Expansion API routes / 提示词扩写 API 路由。
"""

import base64
import logging
import mimetypes
import tempfile
from pathlib import Path

from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.engine import PromptEngine

logger = logging.getLogger(__name__)

router = APIRouter()

# H3生成模式中文描述 / Chinese descriptions for H3 modes
H3_MODE_CN: dict[str, str] = {
    "T2VA": "文生视频(纯文本构建完整视听时间线)",
    "I2VA": "图生视频(从首帧图片出发向前发展)",
    "FL2VA": "首尾帧生视频(描述首帧到尾帧的连续变化路径)",
    "L2VA": "尾帧生视频(推断开头并逐渐收敛到尾帧)",
    "Ref2VA": "全参考生视频(多图+视频+音频全模态参考)",
}


class ExpandRequest(BaseModel):
    """Expand request with Minimax-H3 specific fields / 扩写请求（含Minimax-H3专用字段）。"""
    skill_name: str = "minimax_h3"
    short_prompt: str  # user's requirement description / 用户需求描述
    target_duration: int = 5  # target duration in seconds / 目标时长(秒)
    generation_mode: str = "T2VA"  # H3 generation mode / H3生成模式
    visual_style: str = ""  # visual style keywords / 视觉风格关键词
    expansion_style: str = ""
    target_length: str = ""
    extra_context: str = ""
    images: list[str] = []  # base64 data URLs of reference images / 参考图片的base64数据URL


def _decode_image_data(data: str, temp_dir: Path, index: int) -> str | None:
    """
    Decode a base64 data URL (or raw base64) into a temp image file.
    / 将 base64 数据URL（或纯 base64）解码为临时图片文件。

    Args:
        data: Base64 data URL (e.g. "data:image/png;base64,...") or raw base64.
              / base64 数据URL（如 "data:image/png;base64,..."）或纯 base64.
        temp_dir: Target temp directory / 目标临时目录.
        index: Image index for filename / 图片序号（用于文件名）.

    Returns:
        Saved file path, or None if decoding fails / 保存后的路径，解码失败返回 None.
    """
    mime = "image/png"
    b64 = data

    # Parse data URL prefix / 解析 data URL 前缀
    if data.startswith("data:"):
        header, _, payload = data.partition(",")
        if ";" in header:
            mime = header[len("data:"):].split(";")[0]
        b64 = payload

    try:
        raw = base64.b64decode(b64)
    except Exception as e:
        logger.warning(f"Invalid base64 for image {index}: {e}")
        return None

    ext = mimetypes.guess_extension(mime) or ".png"
    file_path = temp_dir / f"image_{index}{ext}"
    file_path.write_bytes(raw)
    return str(file_path)


@router.post("")
async def expand_prompt(request: Request, body: ExpandRequest):
    """
    Expand a short prompt into a detailed, professional prompt.
    / 将简短提示词扩展为详细、专业的提示词。

    Supports Minimax-H3 video generation prompt format with:
    / 支持 Minimax-H3 视频生成提示词格式：
    - Generation mode (T2VA/I2VA/FL2VA/L2VA/Ref2VA) / 生成模式
    - Visual style / 视觉风格
    - Target duration / 目标时长
    - Reference images (base64) — attached as multimodal input
      / 参考图片（base64）— 作为多模态输入附上
    - Industry-specific requirements / 行业需求描述
    """
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    # Decode base64 images into temp files so providers can consume them as paths
    # / 将 base64 图片解码为临时文件，供 provider 以路径形式消费
    temp_dir = Path(tempfile.mkdtemp())
    image_paths: list[str] = []
    for i, data in enumerate(body.images):
        path = _decode_image_data(data, temp_dir, i)
        if path:
            image_paths.append(path)

    # Build context with Minimax-H3 specific info / 构建包含Minimax-H3专用信息的上下文
    extra_parts = []

    # 生成模式 / Generation mode
    mode_cn = H3_MODE_CN.get(body.generation_mode, body.generation_mode)
    extra_parts.append(
        f"*** 使用此生成模式 / Use this generation mode: {body.generation_mode} ({mode_cn}) ***\n"
        f"请严格按照 {body.generation_mode} 模式的输出格式生成提示词。\n"
        f"Please strictly follow the {body.generation_mode} mode output format."
    )

    # 视觉风格 / Visual style
    if body.visual_style:
        extra_parts.append(
            f"*** 指定视觉风格 / Visual style: {body.visual_style} ***\n"
            f"请在 [Shot 1] 开头使用以上风格描述词作为整体风格声明。\n"
            f"Please use the above style keywords as the overall style declaration at the start of [Shot 1]."
        )

    # 时长 / Duration
    if body.target_duration:
        extra_parts.append(f"目标视频时长 / Target duration: {body.target_duration} 秒/seconds")

    # 素材 / Materials — 明确告知模型已附上实际图片及其对应关系
    if image_paths:
        extra_parts.append(
            f"*** 参考图片 / Reference images: 用户已上传 {len(image_paths)} 张图片，"
            f"并已作为多模态输入附在本消息中 ***\n"
            f"需求描述中的 <Picture N> 按上传顺序对应这些图片，请务必结合图片的实际画面内容来编写提示词，"
            f"使生成结果与参考图片强相关。\n"
            f"The user uploaded {len(image_paths)} reference image(s), attached as multimodal input. "
            f"<Picture N> in the description map to these images in upload order. "
            f"Analyze the actual content of the images and keep the output strongly related to them."
        )

    extra = "\n\n".join(extra_parts)
    if body.extra_context:
        extra += f"\n\n{body.extra_context}"

    try:
        result = await engine.generate(
            feature="expand",
            skill_name=body.skill_name,
            user_text=body.short_prompt,
            images=image_paths or None,
            extra_context=extra,
        )
        return {
            "success": True,
            "result": result.text,
            "model_name": result.model_name,
            "tokens_used": result.tokens_used,
        }
    except Exception as e:
        logger.error(f"Expand prompt failed / 扩写失败: {e}")
        return {"success": False, "error": str(e)}
