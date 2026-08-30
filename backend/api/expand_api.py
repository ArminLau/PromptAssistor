"""
F2: Prompt Expansion API routes / 提示词扩写 API 路由。
"""

import base64
import logging
import math
import mimetypes
import re
import tempfile
from pathlib import Path

from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.engine import PromptEngine, build_output_language_hint

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

# 扩写类型 → 目标 skill 映射 / Expansion type → target skill mapping
EXPANSION_TYPE_SKILL: dict[str, str] = {
    "minimax_h3": "minimax_h3",
    "natural_language": "natural_prompt",
    "danbooru": "danbooru_prompt",
}

# 模型类型显示名 / Model type display names
MODEL_TYPE_LABELS: dict[str, str] = {
    "krea2": "Krea 2",
    "z-image": "Z-Image",
    "flux": "FLUX.1",
    "qwen-image": "Qwen-Image",
    "anima": "Anima",
    "sdxl": "SDXL",
}

# 分段标记正则：匹配「【分段 N · X秒】」/ Segment marker regex: matches 【分段 N · X秒】
# 全角括号避免与 skill 中半角 [Shot N] 冲突 / Full-width brackets avoid colliding with [Shot N]
_SEGMENT_RE = re.compile(r"【\s*分段\s*(\d+)\s*[·|:：,，\-—]\s*(\d+(?:\.\d+)?)\s*秒\s*】")


def _parse_segments(text: str) -> list[dict] | None:
    """解析多段标记，返回 [{index, duration, content}]；不足 2 段返回 None。
    / Parse segment markers into [{index, duration, content}]; return None if fewer than 2.

    Args:
        text: 模型输出的多段提示词文本 / the model's multi-segment output text.

    Returns:
        分段列表（index 从 1 起、duration 为数字、content 为去空白后的提示词），
        或 None 表示未能识别出多段 / segment list, or None if multi-segment not detected.
    """
    matches = list(_SEGMENT_RE.finditer(text))
    if len(matches) < 2:
        return None

    segments: list[dict] = []
    for i, m in enumerate(matches):
        # 每段内容 = 本标记之后到下一个标记之前（末段到文本结尾）
        # / segment content = between this marker and the next marker (or end of text)
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        dur = float(m.group(2))
        segments.append({
            "index": i + 1,
            "duration": int(dur) if dur.is_integer() else round(dur, 1),
            "content": text[m.end():end].strip(),
        })
    return segments


class ExpandRequest(BaseModel):
    """Expand request / 扩写请求。

    支持多种扩写类型 / Supports multiple expansion types:
    - minimax_h3: 视频生成提示词（生成模式/视觉风格/目标时长）
    - natural_language: 自然语言图片提示词（模型类型 + 扩写长度）
    - danbooru: Danbooru标签提示词（模型类型 + 扩写长度）
    """
    expansion_type: str = "minimax_h3"  # 扩写类型判别器 / expansion type discriminator
    skill_name: str = ""  # 目标 skill；为空时由 expansion_type 推导 / derived if empty
    model_type: str = ""  # 模型类型（natural_language/danbooru 用）/ model type
    short_prompt: str  # user's requirement description / 用户需求描述
    target_duration: int = 5  # target duration in seconds / 目标时长(秒)
    segment_duration: int | None = None  # 分段时长(秒)，None=不拆分 / segment duration (seconds), None = no split
    generation_mode: str = "T2VA"  # H3 generation mode / H3生成模式
    visual_style: str = ""  # visual style keywords / 视觉风格关键词
    expansion_style: str = ""
    target_length: int = 0  # 扩写长度(字符) / target length in characters
    output_language: str = ""  # 输出语言 ("zh"/"en") / output language
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

    Supports multiple expansion types / 支持多种扩写类型：
    - minimax_h3: 视频生成提示词（生成模式/视觉风格/目标时长）
    - natural_language: 自然语言图片提示词（模型类型 + 扩写长度）
    - danbooru: Danbooru标签提示词（模型类型 + 扩写长度）
    """
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    # 由 expansion_type 推导目标 skill（未显式提供 skill_name 时）
    # / Derive target skill from expansion_type when skill_name not provided
    skill_name = body.skill_name or EXPANSION_TYPE_SKILL.get(body.expansion_type, "minimax_h3")

    # Decode base64 images into temp files so providers can consume them as paths
    # / 将 base64 图片解码为临时文件，供 provider 以路径形式消费
    temp_dir = Path(tempfile.mkdtemp())
    image_paths: list[str] = []
    for i, data in enumerate(body.images):
        path = _decode_image_data(data, temp_dir, i)
        if path:
            image_paths.append(path)

    # 素材 / Materials — 明确告知模型已附上实际图片及其对应关系（各类型共用）
    # / Reference images note — shared by all expansion types
    extra_parts: list[str] = []

    # 输出语言 / output language
    lang_hint = build_output_language_hint(body.output_language)
    if lang_hint:
        extra_parts.append(lang_hint)

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

    # 分段标志与最少分段数（供后续 max_tokens 与结果解析使用）
    # / multi-segment flag and min segment count (used later for max_tokens and parsing)
    is_multi_segment = False
    min_segments = 0

    # 按扩写类型分支构建专用上下文 / Build type-specific context
    if body.expansion_type == "minimax_h3":
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

        # 分段 / Multi-segment — 目标时长超过分段时长时拆分
        # / Split when target duration exceeds segment duration
        if body.segment_duration and body.target_duration > body.segment_duration:
            min_segments = math.ceil(body.target_duration / body.segment_duration)
            is_multi_segment = True
            extra_parts.append(
                f"*** 分段生成要求 / Multi-segment requirement ***\n"
                f"目标总时长 {body.target_duration} 秒需拆分为多个连续片段：每个片段时长 ≤ "
                f"{body.segment_duration} 秒，片段总数至少 {min_segments} 段（可多于该数量以保证连贯性），"
                f"所有片段时长之和 = {body.target_duration} 秒，各片段时长可不等。\n"
                f"每个片段必须是一个可独立运行的完整 {body.generation_mode} 提示词，"
                f"严格遵循上述 Skill 指南的输出格式，其内部时间线一律从 00:00 开始"
                f"（不要累计前一段的结束时间）。\n"
                f"请根据画面连贯性合理分配分镜：相邻片段之间保持主体、风格、光线、动作的连续性，"
                f"使各段视频按序号无缝拼接。\n"
                f"输出时严格用以下格式分隔每个片段（片段之间不要输出任何额外说明文字）：\n"
                f"【分段 1 · X秒】\n<该片段的完整提示词>\n【分段 2 · X秒】\n<该片段的完整提示词>\n"
                f"…依次类推，直到时长累加至 {body.target_duration} 秒"
            )

    elif body.expansion_type in ("natural_language", "danbooru"):
        # 目标模型 / Target model
        if body.model_type:
            label = MODEL_TYPE_LABELS.get(body.model_type, body.model_type)
            extra_parts.append(
                f"*** 目标模型 / Target model: {label} ***\n"
                f"请严格遵循 Skill 指南中「{label}」章节的提示词规范进行扩写。\n"
                f"Please strictly follow the \"{label}\" section in the skill guide."
            )

        # 扩写长度 / Target length
        if body.target_length:
            extra_parts.append(
                f"*** 扩写长度要求（必须遵守） / Target length (mandatory): "
                f"最终输出必须达到约 {body.target_length} 个字符（含标点与空格），不得明显偏短。***\n"
                f"生成时请持续补充细节（材质、光影、构图、环境、色彩、镜头参数等），"
                f"并在结尾自行核对字数；若不足 {body.target_length} 字符，继续扩写直到达标。\n"
                f"The final output MUST reach approximately {body.target_length} characters "
                f"(including punctuation and spaces); do not stop early — keep adding detail "
                f"until the target length is reached."
            )

    extra = "\n\n".join(extra_parts)
    if body.extra_context:
        extra += f"\n\n{body.extra_context}"

    try:
        # 单次生成，不再因长度不足而自动重试 / single generation, no auto-retry on length.
        # 用户对结果不满意时可再次点击生成按钮重试，避免后台自动重试浪费计算资源。
        # / Users can re-click the generate button when unsatisfied; avoid wasting
        # compute on automatic retries.
        gen_kwargs: dict[str, int] = {}
        if body.target_length:
            # 提高 max_tokens，避免长目标被截断 / raise max_tokens to avoid truncation
            gen_kwargs["max_tokens"] = max(4096, min(body.target_length * 2 + 512, 16384))
        if is_multi_segment:
            # 多段输出更长，提高 max_tokens 避免截断 / raise max_tokens for longer multi-segment output
            gen_kwargs["max_tokens"] = max(4096, min(16384, min_segments * 1500))

        result = await engine.generate(
            feature="expand",
            skill_name=skill_name,
            user_text=body.short_prompt,
            images=image_paths or None,
            extra_context=extra,
            **gen_kwargs,
        )

        # 解析多段结果 / parse multi-segment result (回退为单段 if parse fails)
        segments = _parse_segments(result.text) if is_multi_segment else None
        resp: dict = {
            "success": True,
            "result": result.text,
            "model_name": result.model_name,
            "tokens_used": result.tokens_used,
        }
        if segments:
            resp["segments"] = segments
        return resp
    except Exception as e:
        logger.error(f"Expand prompt failed / 扩写失败: {e}")
        return {"success": False, "error": str(e)}
