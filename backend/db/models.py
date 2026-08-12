"""
SQLAlchemy ORM models for PromptAssistor database.
"""

import json
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def _json_default(obj):
    """Default JSON serializer."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


class Prompt(Base):
    """
    A saved prompt in the user's library.

    Stores the prompt text along with metadata like source model,
    category, tags, and whether it's favorited.
    """

    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False, default="Untitled")
    content = Column(Text, nullable=False, default="")
    model_name = Column(String(200), nullable=True, default="")
    category = Column(String(200), nullable=True, default="General")
    tags = Column(Text, nullable=True, default="[]")  # JSON array
    is_favorite = Column(Boolean, nullable=False, default=False)
    source_type = Column(String(50), nullable=True, default="manual")
    source_media = Column(Text, nullable=True, default="[]")  # JSON array of paths
    notes = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert model to dictionary for API response."""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "model_name": self.model_name,
            "category": self.category,
            "tags": self._parse_tags(),
            "is_favorite": self.is_favorite,
            "source_type": self.source_type,
            "source_media": self._parse_source_media(),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def set_tags(self, tags: list[str]) -> None:
        """Set tags from a list of strings."""
        self.tags = json.dumps(tags, ensure_ascii=False)

    def _parse_tags(self) -> list[str]:
        """Parse tags JSON string to list."""
        try:
            return json.loads(self.tags) if self.tags else []
        except (json.JSONDecodeError, TypeError):
            return []

    def _parse_source_media(self) -> list[str]:
        """Parse source_media JSON string to list."""
        try:
            return json.loads(self.source_media) if self.source_media else []
        except (json.JSONDecodeError, TypeError):
            return []


class SkillOverride(Base):
    """
    A user's custom override for a model skill.

    Allows users to customize official skills for specific industries
    without modifying the original skill files.
    """

    __tablename__ = "skill_overrides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    skill_name = Column(String(200), unique=True, nullable=False)
    override_content = Column(Text, nullable=False, default="")
    description = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert model to dictionary for API response."""
        return {
            "id": self.id,
            "skill_name": self.skill_name,
            "override_content": self.override_content,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
