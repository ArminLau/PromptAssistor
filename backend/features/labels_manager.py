"""
F6: 参考标签库管理 (Reference Tag Library Management)
/ F6: Reference Tag Library Management.

Manages the reference-tag library used by the prompt-generation feature. The
category hierarchy is an arbitrary-depth tree of folders under the labels
directory; the two first-level roots (自然语言 / Danbooru标签) are fixed, and any
folder may contain sub-category folders and tag leaves. Each tag's metadata
(name / content / note) lives in the DB (label_tags table) for fast loading, and
a same-name .txt mirror is kept on disk so a same-name preview image can sit
alongside it.
/ 管理提示词生成功能所用的参考标签库。分类层级是 labels 目录下的任意深度文件夹树；两个一级
根分类（自然语言/Danbooru标签）固定，任意文件夹都可包含子分类文件夹与标签叶子。每个标签的
元数据（名称/内容/备注）存于数据库 label_tags 表以加速加载，同时在磁盘上同步一份同名 .txt，
使同名预览图能与之共存。
"""

import logging
import shutil
import time
from pathlib import Path
from typing import Iterator

from sqlalchemy import func
from sqlalchemy.orm import Session

import app.constants as consts
from db.models import LabelTag

logger = logging.getLogger(__name__)

# 一级分类（固定两项，作为树的根）/ first-level categories (fixed two, tree roots)
_FIRST_CATEGORIES = ["自然语言", "Danbooru标签"]

# 默认二级分类（每个一级分类各自独立一份）/ default second-level categories (each first-level has its own)
_DEFAULT_SECOND_CATEGORIES = ["人物", "服饰", "表情", "动作", "环境", "场景", "镜头"]

# 目录/标签名禁止的字符（Windows 保留 + 路径分隔符）
# / characters forbidden in a name (Windows reserved + path separators)
_FORBIDDEN_NAME_CHARS = set('<>:"/\\|?*')


def _validate_name(name: str) -> str:
    """校验并返回清理后的名称 / Validate and return a cleaned name.

    Args:
        name: 名称 / name.

    Returns:
        去首尾空白后的名称 / trimmed name.

    Raises:
        ValueError: 名称为空、非法或包含路径分隔符 / empty, invalid, or containing separators.
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("名称不能为空 / Name cannot be empty")
    if name in (".", ".."):
        raise ValueError("非法名称 / Invalid name")
    if any(ch in _FORBIDDEN_NAME_CHARS for ch in name):
        raise ValueError("名称包含非法字符 / Name contains forbidden characters")
    if Path(name).name != name:
        raise ValueError("非法名称 / Invalid name")
    # Windows 不允许名称以点或空格结尾 / Windows disallows trailing dots or spaces
    if name.endswith((".", " ")):
        raise ValueError("名称不能以点或空格结尾 / Name cannot end with dot or space")
    return name


def _parse_path(path: str) -> list[str]:
    """解析并校验逻辑路径为段列表 / Parse & validate a logical path into segments.

    Args:
        path: 以 `/` 分隔的相对路径（可为空，表示 labels 根）/ slash-separated relative path
            (empty = labels root).

    Returns:
        校验后的段列表 / validated segment list.
    """
    if path is None:
        path = ""
    path = path.strip().strip("/")
    if not path:
        return []
    parts = path.split("/")
    if any(not p for p in parts):
        raise ValueError("非法路径 / Invalid path")
    return [_validate_name(p) for p in parts]


def _join_path(*segs: str) -> str:
    """拼接路径段为逻辑路径 / Join path segments into a logical path."""
    return "/".join(s for s in segs if s)


def _folder(path: str) -> Path:
    """由逻辑路径解析到文件系统文件夹（防穿越）/ Resolve a logical path to a filesystem folder (traversal-safe)."""
    folder = consts.LABELS_DIR
    for seg in _parse_path(path):
        folder = folder / seg
    return folder


def _tag_txt_path(folder: Path, name: str) -> Path:
    """返回标签同名 .txt 镜像路径 / Return the tag's same-name .txt mirror path."""
    return folder / f"{name}.txt"


def _preview_path(folder: Path, name: str) -> Path | None:
    """返回标签同名预览图路径（若存在）/ Return the tag's same-name preview image path (if any).

    Args:
        folder: 分类文件夹 / category folder.
        name: 标签名 / tag name.

    Returns:
        同名图片的绝对路径，无则 None / the same-name image path, or None.
    """
    if not folder.is_dir():
        return None
    for p in folder.iterdir():
        if p.is_file() and p.stem == name and p.suffix.lower() in consts.SUPPORTED_IMAGE_FORMATS:
            return p
    return None


def _remove_file_robust(path: Path) -> bool:
    """删除单个文件，带短暂重试 / Delete a single file with brief retries.

    Returns:
        True 表示已删除（或本就不存在）/ True if removed (or never existed).
    """
    if not path.exists():
        return True
    for attempt in range(3):
        try:
            path.unlink()
            return True
        except OSError:
            if attempt < 2:
                time.sleep(0.15)
    return not path.exists()


def _remove_tree_robust(folder: Path) -> bool:
    """递归删除文件夹，带短暂重试（Windows 文件占用容错）/ Recursively delete a folder with brief retries."""
    if not folder.exists():
        return True
    for attempt in range(3):
        try:
            shutil.rmtree(folder)
            return True
        except OSError:
            if attempt < 2:
                time.sleep(0.15)
    return not folder.exists()


def ensure_defaults() -> None:
    """确保 labels 目录与默认一级/二级分类文件夹存在 / Ensure the labels dir and default folders exist."""
    consts.LABELS_DIR.mkdir(parents=True, exist_ok=True)
    for first in _FIRST_CATEGORIES:
        first_folder = consts.LABELS_DIR / first
        first_folder.mkdir(parents=True, exist_ok=True)
        for second in _DEFAULT_SECOND_CATEGORIES:
            (first_folder / second).mkdir(parents=True, exist_ok=True)


def _build_node(db: Session, folder: Path, path: str) -> dict:
    """递归构建树节点 / Recursively build a tree node.

    Returns:
        `{name, path, children: [node...], tags: [{name, content, note, has_preview}]}`.
    """
    node: dict = {"name": folder.name, "path": path, "children": [], "tags": []}
    # 子分类（文件夹）/ sub-categories (folders)
    subdirs = sorted(
        (p for p in folder.iterdir() if p.is_dir()), key=lambda p: p.name.lower()
    )
    for d in subdirs:
        node["children"].append(_build_node(db, d, _join_path(path, d.name)))
    # 标签（DB 行，path 匹配）/ tags (DB rows whose path matches)
    rows = (
        db.query(LabelTag)
        .filter(LabelTag.path == path)
        .order_by(LabelTag.name)
        .all()
    )
    node["tags"] = [
        {
            "name": row.name,
            "content": row.content,
            "note": row.note,
            "has_preview": _preview_path(folder, row.name) is not None,
        }
        for row in rows
    ]
    return node


def get_tree(db: Session) -> list[dict]:
    """返回标签库完整树 / Return the full tag library tree.

    Returns:
        两个一级根节点 / the two first-level root nodes.
    """
    ensure_defaults()
    result: list[dict] = []
    for first in _FIRST_CATEGORIES:
        first_folder = consts.LABELS_DIR / first
        result.append(_build_node(db, first_folder, first))
    return result


def _is_root(path: str) -> bool:
    """判断是否是一级根分类 / Whether the path is a first-level root."""
    return not _parse_path(path) or "/" not in path.strip().strip("/")


def create_category(parent_path: str, name: str) -> dict:
    """在指定父分类下创建子分类 / Create a sub-category under a parent category.

    Args:
        parent_path: 父分类逻辑路径（不能为空，一级分类固定）/ parent category path (non-empty).
        name: 新分类名 / new category name.

    Returns:
        `{path, name}`.
    """
    name = _validate_name(name)
    segments = _parse_path(parent_path)
    if not segments:
        raise ValueError("一级分类固定，不能新增 / First-level categories are fixed")

    parent = _folder(parent_path)
    if not parent.is_dir():
        raise ValueError(f"父分类不存在 / Parent category does not exist: {parent_path}")

    folder = parent / name
    if folder.exists():
        raise ValueError(f"分类已存在 / Category already exists: {name}")

    folder.mkdir(parents=True, exist_ok=True)
    return {"path": _join_path(parent_path, name), "name": name}


def rename_category(db: Session, path: str, new_name: str) -> dict:
    """重命名分类（移动文件夹 + 更新后代标签 path）/ Rename a category (move folder + update descendant paths)."""
    new_name = _validate_name(new_name)
    if _is_root(path):
        raise ValueError("一级分类固定，不能重命名 / First-level categories cannot be renamed")

    folder = _folder(path)
    if not folder.is_dir():
        raise ValueError(f"分类不存在 / Category does not exist: {path}")

    new_folder = folder.parent / new_name
    if new_folder.exists():
        raise ValueError(f"目标名称已存在 / Target name already exists: {new_name}")

    folder.rename(new_folder)

    # 更新该分类及其所有后代标签的 path / update this category's and all descendants' tag paths
    segments = _parse_path(path)
    new_path = _join_path(*(segments[:-1] + [new_name]))
    _rename_tag_paths(db, path, new_path)
    return {"path": new_path, "name": new_name}


def _rename_tag_paths(db: Session, old_path: str, new_path: str) -> None:
    """把 old_path 及后代标签的 path 前缀替换为 new_path / Rewrite tag paths under old_path to new_path."""
    prefix = old_path + "/"
    rows = (
        db.query(LabelTag)
        .filter((LabelTag.path == old_path) | (LabelTag.path.like(prefix + "%")))
        .all()
    )
    for row in rows:
        row.path = new_path + row.path[len(old_path):]
    db.commit()


def delete_category(db: Session, path: str) -> None:
    """删除分类（递归删文件夹 + 级联删后代标签）/ Delete a category (remove folder + descendant tags)."""
    if _is_root(path):
        raise ValueError("一级分类固定，不能删除 / First-level categories cannot be deleted")

    folder = _folder(path)
    if folder.is_dir() and not _remove_tree_robust(folder):
        raise ValueError(f"分类删除失败（文件被占用）/ Failed to delete category (files in use): {path}")

    prefix = path + "/"
    db.query(LabelTag).filter(
        (LabelTag.path == path) | (LabelTag.path.like(prefix + "%"))
    ).delete()
    db.commit()


def _get_tag_row(db: Session, path: str, name: str) -> LabelTag | None:
    """按分类与名称查询标签记录（大小写不敏感）/ Query a tag row by path and name (case-insensitive)."""
    return (
        db.query(LabelTag)
        .filter(LabelTag.path == path, func.lower(LabelTag.name) == name.lower())
        .first()
    )


def create_tag(db: Session, path: str, name: str, content: str, note: str) -> dict:
    """创建标签（写 DB + txt，防重名）/ Create a tag (write DB + txt, duplicate-guarded)."""
    name = _validate_name(name)

    folder = _folder(path)
    if not folder.is_dir():
        raise ValueError(f"分类不存在 / Category does not exist: {path}")
    if _get_tag_row(db, path, name) is not None:
        raise ValueError(f"标签已存在 / Tag already exists: {name}")
    if _tag_txt_path(folder, name).exists():
        raise ValueError(f"同名文件已存在 / File with the same name exists: {name}")

    tag = LabelTag(path=path, name=name, content=content or "", note=note or "")
    db.add(tag)
    db.commit()

    _tag_txt_path(folder, name).write_text(content or "", encoding="utf-8")
    return tag.to_dict()


def update_tag(db: Session, path: str, name: str, fields: dict) -> dict:
    """更新标签（同步 DB + txt，支持改名）/ Update a tag (sync DB + txt; supports rename)."""
    name = _validate_name(name)

    tag = _get_tag_row(db, path, name)
    if tag is None:
        raise ValueError(f"标签不存在 / Tag does not exist: {name}")

    folder = _folder(path)
    new_name = name
    if fields.get("name"):
        new_name = _validate_name(fields["name"])
        if new_name != name:
            if _get_tag_row(db, path, new_name) is not None:
                raise ValueError(f"目标名称已存在 / Target name already exists: {new_name}")
            if _tag_txt_path(folder, new_name).exists():
                raise ValueError(f"同名文件已存在 / File with the same name exists: {new_name}")

    if "content" in fields:
        tag.content = fields["content"] or ""
    if "note" in fields:
        tag.note = fields["note"] or ""

    # 改名时同步移动 txt 与预览图 / when renaming, move the txt and preview image too
    if new_name != name:
        tag.name = new_name
        old_txt = _tag_txt_path(folder, name)
        new_txt = _tag_txt_path(folder, new_name)
        if old_txt.exists():
            old_txt.rename(new_txt)
        old_preview = _preview_path(folder, name)
        if old_preview is not None:
            old_preview.rename(folder / f"{new_name}{old_preview.suffix}")

    db.commit()

    # 写回 txt 镜像（内容）/ write back the txt mirror (content)
    _tag_txt_path(folder, new_name).write_text(tag.content, encoding="utf-8")
    return tag.to_dict()


def delete_tag(db: Session, path: str, name: str) -> None:
    """删除标签（删 DB 行 + txt + 预览图）/ Delete a tag (remove DB row + txt + preview image)."""
    name = _validate_name(name)

    tag = _get_tag_row(db, path, name)
    folder = _folder(path)

    if folder.is_dir():
        _remove_file_robust(_tag_txt_path(folder, name))
        preview = _preview_path(folder, name)
        if preview is not None:
            _remove_file_robust(preview)

    if tag is not None:
        db.delete(tag)
        db.commit()


def resolve_preview_path(path: str, name: str) -> Path | None:
    """解析标签预览图绝对路径（严格路径校验防穿越）/ Resolve a tag's preview image path (traversal-safe).

    Args:
        path: 父分类逻辑路径 / parent category path.
        name: 标签名 / tag name.

    Returns:
        图片绝对路径，无则 None / the image path, or None.
    """
    safe_name = Path(name).name
    if safe_name != name or not safe_name or safe_name in (".", ".."):
        return None

    try:
        folder = _folder(path)
    except ValueError:
        return None
    if not folder.is_dir():
        return None
    return _preview_path(folder, safe_name)


def _read_tag_text(path: Path) -> str:
    """读取标签 txt 内容（UTF-8 优先，回退 GBK）/ Read tag txt content (UTF-8 first, GBK fallback).

    Args:
        path: txt 文件路径 / txt file path.

    Returns:
        解码后的文本内容 / decoded text content.
    """
    data = path.read_bytes()
    for enc in ("utf-8", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _walk_dirs(folder: Path) -> Iterator[Path]:
    """递归产出 folder 及其所有子目录 / Recursively yield folder and all subdirectories."""
    yield folder
    for child in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
        if child.is_dir():
            yield from _walk_dirs(child)


def sync_tags_from_disk(db: Session) -> dict:
    """启动时扫描 labels 目录，将 txt 标签文件同步到数据库。

    / Scan the labels dir on startup and sync txt tag files into the DB.

    若 labels 目录下不存在任何标签 txt 文件，则不执行任何操作。若存在，则递归扫描各分类
    目录下的 txt 文件并同步：新增标签以空备注创建；已存在标签仅更新内容、保留原备注。
    预览图由 `get_tree` 读取时按同名图片自动识别，无需在此处理。
    / If the labels dir contains no tag txt files, do nothing. Otherwise, recursively
    scan txt files under each category folder and sync them: new tags are created with
    an empty note; existing tags have their content updated while their note is preserved.
    Preview images are auto-detected by `get_tree` via same-name images, so no handling
    is needed here.

    Args:
        db: 数据库会话 / database session.

    Returns:
        `{scanned, created, updated}` 统计 / sync statistics.
    """
    if not consts.LABELS_DIR.is_dir():
        return {"scanned": 0, "created": 0, "updated": 0}

    # 收集 (path, name, content) / collect (path, name, content) tuples
    txt_entries: list[tuple[str, str, str]] = []
    for first in _FIRST_CATEGORIES:
        first_folder = consts.LABELS_DIR / first
        if not first_folder.is_dir():
            continue
        for folder in _walk_dirs(first_folder):
            rel = folder.relative_to(consts.LABELS_DIR).as_posix()
            for p in folder.iterdir():
                if p.is_file() and p.suffix.lower() == ".txt" and p.stem:
                    txt_entries.append((rel, p.stem, _read_tag_text(p)))

    # 无任何标签 txt 文件时不做任何事 / do nothing if there are no tag txt files
    if not txt_entries:
        return {"scanned": 0, "created": 0, "updated": 0}

    created = 0
    updated = 0
    for path, name, content in txt_entries:
        row = _get_tag_row(db, path, name)
        if row is None:
            # 新增标签：备注为空 / new tag: empty note
            db.add(LabelTag(path=path, name=name, content=content, note=""))
            created += 1
        else:
            # 已存在标签：仅更新内容，保留备注 / existing tag: update content only, preserve note
            row.content = content
            updated += 1
    db.commit()

    logger.info(
        f"Labels synced from disk / 标签已从磁盘同步: "
        f"{len(txt_entries)} files, {created} created, {updated} updated"
    )
    return {"scanned": len(txt_entries), "created": created, "updated": updated}
