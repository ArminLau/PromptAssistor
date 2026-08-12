"""
F5: Skill维护 (Skill Editor)

Allows users to:
- View original skill content
- Create custom overrides for specific industries
- Validate skill file format
- Reset to original skill

Overrides are stored in the database and take priority over original files.
"""

import logging

import yaml

logger = logging.getLogger(__name__)


def validate_skill_yaml(content: str) -> tuple[bool, str | None]:
    """
    Validate that a skill markdown string has proper YAML frontmatter.

    Args:
        content: The full skill markdown string.

    Returns:
        Tuple of (is_valid, error_message). error_message is None if valid.
    """
    if not content.strip().startswith("---"):
        return False, "Skill 文件必须以 '---' (YAML frontmatter) 开头"

    parts = content.split("---", 2)
    if len(parts) < 3:
        return False, "YAML frontmatter 格式不正确，需要以 '---' 开始和结束"

    yaml_text = parts[1].strip()

    try:
        metadata = yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        return False, f"YAML 解析错误: {e}"

    if not isinstance(metadata, dict):
        return False, "YAML frontmatter 必须是键值对格式"

    # Check required fields
    required_fields = ["name", "display_name", "type", "version"]
    missing = [f for f in required_fields if f not in metadata]
    if missing:
        return False, f"缺少必填字段: {', '.join(missing)}"

    markdown_body = parts[2].strip()
    if not markdown_body:
        return False, "Skill 内容(Markdown正文)不能为空"

    return True, None


def merge_skill_with_override(
    original_content: str,
    override_content: str | None,
) -> str:
    """
    Return the effective skill content, preferring override if available.

    Args:
        original_content: The original skill markdown.
        override_content: The user's override markdown, or None.

    Returns:
        The effective skill content to use.
    """
    if override_content and override_content.strip():
        return override_content
    return original_content
