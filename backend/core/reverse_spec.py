"""
Shared reverse-engineering context builders.
/ 反推上下文构建共享模块。

Extracted from reverse_api.py so the reverse feature (F1) and the batch
tagging feature (F3) can reuse the same target-model labels, style
instructions, and extra-context assembly without importing across features.
/ 从reverse_api.py抽取，使反推(F1)与批量打标(F3)复用相同的目标模型标签、
风格指令与附加上下文拼装，避免 feature 模块之间互相导入。
"""

from core.engine import build_output_language_hint

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


def parse_reverse_target(value: str) -> tuple[str, str]:
    """解析反推目标原始值 → (skill, model_type) / Parse raw reverse target into (skill, model_type).

    原始值编码为 `skill:model_type`（如 `natural_prompt:krea2`），`reference`
    表示完全参考模式（无 skill）。
    / The raw value is encoded as `skill:model_type` (e.g. `natural_prompt:krea2`);
    `reference` means reference-only mode (no skill).

    Args:
        value: 反推目标原始值 / raw reverse target value.

    Returns:
        (skill名称, 模型类型) 二元组；参考模式两者均为空串。
        / a (skill_name, model_type) tuple; both empty for reference mode.
    """
    if not value or value == "reference":
        return "", ""
    idx = value.find(":")
    if idx < 0:
        return value, ""
    return value[:idx], value[idx + 1:]


def build_extra_context(
    skill_name: str,
    model_type: str,
    target_length: int,
    reverse_style: str,
    output_language: str,
) -> str:
    """按参数拼装注入 system prompt 的附加上下文 / Build extra context injected into the system prompt.

    Args:
        skill_name: 目标 skill 名称 / target skill name.
        model_type: 目标模型类型（krea2/z-image/flux/qwen-image/anima/sdxl）.
        target_length: 提示词长度（字符）/ target length in characters.
        reverse_style: 反推风格（five_point/multi_paragraph/short）.
        output_language: 输出语言（"zh"/"en"）.

    Returns:
        拼装好的附加上下文文本 / assembled extra-context text.
    """
    parts: list[str] = []

    # 输出语言 / output language
    lang_hint = build_output_language_hint(output_language)
    if lang_hint:
        parts.append(lang_hint)

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
