"""
Skill manager for PromptAssistor.

Responsible for discovering, loading, parsing, and caching model skill files.
Skills are YAML + Markdown files stored in the skills/ directory.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

# 注意: SKILLS_DIR 是可变常量，会被 workspace_manager.apply_workspace() 更新
# 使用 import app.constants 然后通过属性访问以获取最新值
# Note: SKILLS_DIR is mutable — updated by workspace_manager.apply_workspace().
# Access via app.constants to get the workspace-overridden value.
import app.constants as consts
from app.constants import SkillType

logger = logging.getLogger(__name__)


class SkillError(Exception):
    """Base exception for skill-related errors."""
    pass


class SkillNotFoundError(SkillError):
    """Raised when a requested skill is not found."""
    pass


class SkillParseError(SkillError):
    """Raised when a skill file cannot be parsed."""
    pass


class Skill:
    """Represents a loaded model skill."""

    def __init__(self, data: dict[str, Any], source_path: Path) -> None:
        self.name: str = data.get("name", "")
        self.display_name: str = data.get("display_name", self.name)
        self.skill_type: str = data.get("type", SkillType.IMAGE_GENERATION.value)
        self.version: str = data.get("version", "0.1.0")
        self.author: str = data.get("author", "Unknown")
        self.description: str = data.get("description", "")
        self.tags: list[str] = data.get("tags", [])
        self.updated: str = data.get("updated", "")
        self.content: str = data.get("content", "")
        self.source_path: Path = source_path

    def to_dict(self) -> dict[str, Any]:
        """Convert skill to a serializable dictionary."""
        return {
            "name": self.name,
            "display_name": self.display_name,
            "type": self.skill_type,
            "version": self.version,
            "author": self.author,
            "description": self.description,
            "tags": self.tags,
            "updated": self.updated,
            "content": self.content,
            "source_path": str(self.source_path),
        }


class SkillManager:
    """
    Manages the lifecycle of model skills.

    Discover skills from the skills/ directory, parse them, and provide
    access to skill content for the prompt engine.

    Usage:
        manager = SkillManager()
        manager.discover()
        skill = manager.get_skill("minimax_h3")
        all_skills = manager.list_skills()
    """

    _instance: "SkillManager | None" = None

    def __new__(cls, skills_dir: Path | None = None) -> "SkillManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, skills_dir: Path | None = None) -> None:
        if self._initialized:
            return
        # 动态访问以获取工作空间覆盖后的最新值
        # Dynamic access to get workspace-overridden value
        self._skills_dir = skills_dir or consts.SKILLS_DIR
        self._skills: dict[str, Skill] = {}  # name → Skill
        self._initialized = True

    def discover(self) -> list[Skill]:
        """
        Scan the skills directory and load all valid skill files.

        Returns:
            List of successfully loaded Skill objects.

        Skill files that fail to parse are logged as warnings and skipped.
        """
        if not self._skills_dir.exists():
            logger.warning(f"Skills directory not found: {self._skills_dir}")
            return []

        self._skills.clear()
        loaded: list[Skill] = []

        for skill_dir in self._skills_dir.iterdir():
            if not skill_dir.is_dir():
                continue
            if skill_dir.name.startswith(".") or skill_dir.name.startswith("_"):
                continue

            skill_file = skill_dir / "skill.md"
            if not skill_file.exists():
                logger.debug(f"No skill.md found in {skill_dir}, skipping")
                continue

            try:
                skill = self._load_skill_file(skill_file)
                self._skills[skill.name] = skill
                loaded.append(skill)
                logger.info(f"Loaded skill: {skill.display_name} (v{skill.version})")
            except SkillParseError as e:
                logger.warning(f"Failed to load skill from {skill_file}: {e}")

        logger.info(f"Discovered {len(loaded)} skill(s) from {self._skills_dir}")
        return loaded

    def reload(self) -> list[Skill]:
        """Reload all skills from disk. Useful after skill edits."""
        logger.info("Reloading all skills...")
        return self.discover()

    def get_skill(self, name: str) -> Skill:
        """
        Get a skill by its name identifier.

        Args:
            name: The skill name (e.g., "minimax_h3").

        Returns:
            The Skill object.

        Raises:
            SkillNotFoundError: If the skill is not found.
        """
        if name not in self._skills:
            # Try to reload in case a new skill was added
            self.discover()
            if name not in self._skills:
                raise SkillNotFoundError(f"Skill not found: {name}")
        return self._skills[name]

    def list_skills(
        self,
        skill_type: str | None = None,
        tag: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        List all available skills, optionally filtered.

        Args:
            skill_type: Filter by skill type (image_generation / video_generation).
            tag: Filter by tag.

        Returns:
            List of skill info dictionaries (without full content for brevity).
        """
        result = []
        for skill in self._skills.values():
            if skill_type and skill.skill_type != skill_type:
                continue
            if tag and tag not in skill.tags:
                continue
            # Return summary only (content can be large)
            info = skill.to_dict()
            info.pop("content", None)
            result.append(info)
        return result

    def get_skill_content(self, name: str) -> str:
        """
        Get the full content of a skill (the markdown body).

        This is the main method used by the prompt engine to get
        skill instructions for inclusion in the system prompt.

        Args:
            name: The skill name.

        Returns:
            The markdown content of the skill.

        Raises:
            SkillNotFoundError: If the skill is not found.
        """
        skill = self.get_skill(name)
        return skill.content

    def has_skill(self, name: str) -> bool:
        """Check if a skill with the given name exists."""
        return name in self._skills

    def get_skill_names(self) -> list[str]:
        """Return all loaded skill names."""
        return list(self._skills.keys())

    def _load_skill_file(self, file_path: Path) -> Skill:
        """
        Load and parse a single skill markdown file.

        Expected format:
            ---
            key: value  (YAML frontmatter)
            ---
            # Markdown content
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                raw_text = f.read()
        except OSError as e:
            raise SkillParseError(f"Cannot read file: {e}") from e

        # Parse YAML frontmatter
        if not raw_text.startswith("---"):
            raise SkillParseError("Missing YAML frontmatter (file must start with ---)")

        parts = raw_text.split("---", 2)
        if len(parts) < 3:
            raise SkillParseError("Invalid YAML frontmatter format")

        yaml_text = parts[1].strip()
        markdown_content = parts[2].strip()

        try:
            metadata = yaml.safe_load(yaml_text)
        except yaml.YAMLError as e:
            raise SkillParseError(f"YAML parse error: {e}") from e

        if not isinstance(metadata, dict):
            raise SkillParseError("YAML frontmatter must be a mapping")

        if "name" not in metadata:
            raise SkillParseError("Required field 'name' missing in frontmatter")

        metadata["content"] = markdown_content
        return Skill(metadata, file_path)
