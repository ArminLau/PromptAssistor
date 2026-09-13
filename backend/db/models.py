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


class Dataset(Base):
    """
    数据集 / Dataset.

    A dataset is a subfolder under the datasets directory. Each dataset keeps
    its own independent reverse-engineering configuration (target model, prompt
    length, style, output language), persisted so reopening shows the last config.
    / 数据集是datasets目录下的一个子文件夹。每个数据集持有独立的反推配置，持久化后重新打开即回填。
    """

    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), unique=True, nullable=False)
    # 反推目标原始值 / raw reverse target value (e.g. "natural_prompt:krea2" or "reference")
    reverse_target = Column(String(200), nullable=False, default="natural_prompt:krea2")
    target_length = Column(Integer, nullable=False, default=500)
    reverse_style = Column(String(50), nullable=False, default="five_point")
    output_language = Column(String(10), nullable=False, default="zh")
    # 反推需求描述（优先级最高）/ reverse requirement description (highest priority)
    reverse_requirement = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert model to dictionary for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "reverse_target": self.reverse_target,
            "target_length": self.target_length,
            "reverse_style": self.reverse_style,
            "output_language": self.output_language,
            "reverse_requirement": self.reverse_requirement,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class LabelTag(Base):
    """
    参考标签 / Reference label tag.

    A tag in the F6 reference-tag library. The category hierarchy is an
    arbitrary-depth tree of folders under the labels directory (first-level:
    自然语言 / Danbooru标签); a tag is a leaf located in some folder. The DB is
    the source of truth for a tag's name/content/note (fast loading); a same-name
    .txt file is kept in sync on disk so a same-name preview image can sit
    alongside it in the category folder.
    / 参考标签库中的标签。分类层级是 labels 目录下的任意深度文件夹树（一级：自然语言/Danbooru标签）；
    标签是位于某文件夹下的叶子。数据库是标签 名称/内容/备注 的唯一事实源（加载快）；同时在磁盘上
    同步一份同名 .txt，以便同名预览图能存在于分类文件夹中。
    """

    __tablename__ = "label_tags"
    __table_args__ = (
        UniqueConstraint("path", "name", name="uq_label_tag"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 父分类相对路径（以 / 分隔，如 "自然语言/人物/发型"）/ parent category path
    path = Column(String(500), nullable=False, default="")
    name = Column(String(200), nullable=False)             # 标签名 = 文件名 stem / tag name
    content = Column(Text, nullable=False, default="")     # 内容（模型参考）/ content
    note = Column(Text, nullable=False, default="")        # 备注 / note
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert model to dictionary for API response."""
        return {
            "id": self.id,
            "path": self.path,
            "name": self.name,
            "content": self.content,
            "note": self.note,
        }


class DatasetItem(Base):
    """
    数据集素材 / Dataset item.

    A single image (with its same-name .txt prompt) inside a dataset. The
    filesystem is the source of truth; this table is an index cache that makes
    listing a dataset fast without re-reading every .txt file.
    / 数据集内的一张图片（及同名txt提示词）。文件系统是唯一事实源，本表作为索引缓存加速列表加载。
    """

    __tablename__ = "dataset_items"
    __table_args__ = (
        UniqueConstraint("dataset_id", "filename", name="uq_dataset_item_file"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(500), nullable=False)
    prompt_text = Column(Text, nullable=True, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert model to dictionary for API response."""
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "filename": self.filename,
            "prompt_text": self.prompt_text,
        }
