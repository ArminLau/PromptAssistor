"""
F3: 数据集管理 (Dataset Management)
/ F3: Dataset Management.

Manages datasets for batch tagging: each dataset is a subfolder under the
datasets directory, containing image files and a same-name .txt prompt per
image. The filesystem is the source of truth; the DB (datasets / dataset_items
tables) is an index cache that also persists each dataset's independent
reverse-engineering configuration.
/ 管理批量打标的数据集：每个数据集是 datasets 目录下的一个子文件夹，内含图片及与图片
同名的 .txt 提示词。文件系统是唯一事实源，数据库(datasets/dataset_items 表)作为索引缓存，
同时持久化每个数据集独立的反推配置。
"""

import logging
import shutil
import time
from pathlib import Path

from sqlalchemy.orm import Session

import app.constants as consts
from core.reverse_spec import build_extra_context, parse_reverse_target
from db.models import Dataset, DatasetItem

logger = logging.getLogger(__name__)

# 目录名禁止的字符（Windows 保留 + 路径分隔符）
# / characters forbidden in a folder name (Windows reserved + path separators)
_FORBIDDEN_NAME_CHARS = set('<>:"/\\|?*')


def _validate_name(name: str) -> str:
    """校验并返回清理后的数据集名称 / Validate and return a cleaned dataset name.

    Args:
        name: 数据集名称 / dataset name.

    Returns:
        去首尾空白后的名称 / trimmed name.

    Raises:
        ValueError: 名称为空、非法或包含路径分隔符 / empty, invalid, or containing separators.
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("数据集名称不能为空 / Dataset name cannot be empty")
    if name in (".", ".."):
        raise ValueError("非法数据集名称 / Invalid dataset name")
    if any(ch in _FORBIDDEN_NAME_CHARS for ch in name):
        raise ValueError("数据集名称包含非法字符 / Dataset name contains forbidden characters")
    if Path(name).name != name:
        raise ValueError("非法数据集名称 / Invalid dataset name")
    return name


def _dataset_folder(name: str) -> Path:
    """返回数据集文件夹路径 / Return the dataset folder path."""
    return consts.DATASETS_DIR / name


def _list_image_files(folder: Path) -> list[Path]:
    """列出文件夹内的图片文件（按名称排序）/ List image files in a folder (name-sorted)."""
    if not folder.is_dir():
        return []
    return sorted(
        (
            p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in consts.SUPPORTED_IMAGE_FORMATS
        ),
        key=lambda p: p.name.lower(),
    )


def _prompt_txt_path(image_path: Path) -> Path:
    """返回图片对应的同名 .txt 提示词路径 / Return the same-name .txt prompt path for an image."""
    return image_path.with_suffix(".txt")


def _read_prompt(image_path: Path) -> str | None:
    """读取图片同名 .txt 内容；不存在返回 None / Read the image's .txt prompt; None if absent."""
    txt = _prompt_txt_path(image_path)
    if not txt.exists():
        return None
    return txt.read_text(encoding="utf-8", errors="replace")


def _get_dataset_row(db: Session, name: str) -> Dataset | None:
    """按名称查询数据集记录 / Query a dataset row by name."""
    return db.query(Dataset).filter(Dataset.name == name).first()


def _sync_items(db: Session, dataset: Dataset, folder: Path) -> None:
    """从文件系统同步 dataset_items 索引缓存 / Sync the dataset_items index cache from the filesystem.

    新增缺失的图片行、删除已不存在的行、并用磁盘上的 .txt 内容刷新 prompt_text。
    / Insert rows for new images, drop rows for removed images, and refresh
    prompt_text from on-disk .txt files.
    """
    image_files = _list_image_files(folder)
    existing = {
        item.filename: item
        for item in db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset.id).all()
    }

    filenames: set[str] = set()
    for img in image_files:
        filenames.add(img.name)
        item = existing.get(img.name)
        prompt_text = _read_prompt(img)
        if item is None:
            db.add(DatasetItem(dataset_id=dataset.id, filename=img.name, prompt_text=prompt_text))
        else:
            item.prompt_text = prompt_text

    for fname, item in existing.items():
        if fname not in filenames:
            db.delete(item)

    db.commit()


def list_datasets(db: Session, search: str | None = None) -> list[dict]:
    """列出所有数据集（含封面与数量），支持名称模糊搜索 / List datasets with cover & count, optional fuzzy search.

    Args:
        db: 数据库会话 / database session.
        search: 模糊搜索关键词（匹配数据集名称）/ fuzzy keyword matched against dataset name.

    Returns:
        数据集卡片信息列表 / list of dataset card info dicts.
    """
    consts.DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    new_rows: list[Dataset] = []
    for folder in sorted(consts.DATASETS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not folder.is_dir():
            continue
        if _get_dataset_row(db, folder.name) is None:
            new_rows.append(Dataset(name=folder.name))
    if new_rows:
        db.add_all(new_rows)
        db.commit()

    result: list[dict] = []
    for folder in sorted(consts.DATASETS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not folder.is_dir():
            continue
        if search and search.lower() not in folder.name.lower():
            continue
        images = _list_image_files(folder)
        result.append({
            "name": folder.name,
            "item_count": len(images),
            "cover_filename": images[0].name if images else None,
        })
    return result


def create_dataset(db: Session, name: str) -> dict:
    """创建新数据集（禁止重名）/ Create a new dataset (duplicate names rejected).

    Args:
        db: 数据库会话 / database session.
        name: 数据集名称 / dataset name.

    Returns:
        创建后的数据集信息 / created dataset info.
    """
    name = _validate_name(name)
    consts.DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    if _dataset_folder(name).exists() or _get_dataset_row(db, name) is not None:
        raise ValueError(f"数据集已存在 / Dataset already exists: {name}")

    _dataset_folder(name).mkdir(parents=True, exist_ok=True)
    dataset = Dataset(name=name)
    db.add(dataset)
    db.commit()
    return dataset.to_dict()


def rename_dataset(db: Session, old_name: str, new_name: str) -> dict:
    """重命名数据集（同步改名文件夹与 DB 记录）/ Rename a dataset (rename folder + DB row)."""
    new_name = _validate_name(new_name)
    if old_name == new_name:
        return _get_dataset_row(db, old_name).to_dict()

    old_folder = _dataset_folder(old_name)
    if not old_folder.is_dir():
        raise ValueError(f"数据集不存在 / Dataset does not exist: {old_name}")

    new_folder = _dataset_folder(new_name)
    if new_folder.exists() or _get_dataset_row(db, new_name) is not None:
        raise ValueError(f"目标名称已存在 / Target name already exists: {new_name}")

    old_folder.rename(new_folder)

    dataset = _get_dataset_row(db, old_name)
    if dataset is not None:
        dataset.name = new_name
        db.commit()
        return dataset.to_dict()
    return {"name": new_name}


def _remove_file_robust(path: Path) -> bool:
    """删除单个文件，带短暂重试 / Delete a single file with brief retries.

    Windows 上删除一个刚被占用的文件（如仍在被浏览器加载的缩略图）会抛
    PermissionError (WinError 32)。这里做短暂重试，锁通常几毫秒内释放。
    / On Windows, deleting a briefly-locked file (e.g. a thumbnail still being
    served to the browser) raises PermissionError. Retry briefly — the lock
    usually releases within milliseconds.

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
    """递归删除目录，带短暂重试 / Recursively remove a folder with brief retries.

    Returns:
        True 表示已删除（或本就不存在）/ True if removed (or never existed).
    """
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


def delete_dataset(db: Session, name: str) -> None:
    """删除数据集（递归删文件夹 + 级联删 DB 记录）/ Delete a dataset (recursively remove folder + DB rows)."""
    folder = _dataset_folder(name)
    if folder.is_dir() and not _remove_tree_robust(folder):
        raise ValueError(f"删除失败，目录被占用 / Failed to delete folder (in use): {folder}")

    dataset = _get_dataset_row(db, name)
    if dataset is not None:
        db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset.id).delete()
        db.delete(dataset)
        db.commit()


def get_dataset_detail(db: Session, name: str, page: int = 1, page_size: int = 12) -> dict:
    """获取数据集详情（配置 + 分页素材）/ Get dataset detail (config + paginated items)."""
    dataset = _get_dataset_row(db, name)
    if dataset is None:
        raise ValueError(f"数据集不存在 / Dataset does not exist: {name}")

    folder = _dataset_folder(name)
    _sync_items(db, dataset, folder)

    total = db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset.id).count()
    items = (
        db.query(DatasetItem)
        .filter(DatasetItem.dataset_id == dataset.id)
        .order_by(DatasetItem.filename)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "name": name,
        "config": {
            "reverse_target": dataset.reverse_target,
            "target_length": dataset.target_length,
            "reverse_style": dataset.reverse_style,
            "output_language": dataset.output_language,
        },
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {"filename": item.filename, "prompt_text": item.prompt_text}
            for item in items
        ],
    }


def update_dataset_config(db: Session, name: str, config: dict) -> dict:
    """更新数据集的反推配置（持久化到 DB）/ Update a dataset's reverse config (persisted to DB)."""
    dataset = _get_dataset_row(db, name)
    if dataset is None:
        raise ValueError(f"数据集不存在 / Dataset does not exist: {name}")

    if "reverse_target" in config:
        dataset.reverse_target = config["reverse_target"]
    if "target_length" in config:
        dataset.target_length = int(config["target_length"])
    if "reverse_style" in config:
        dataset.reverse_style = config["reverse_style"]
    if "output_language" in config:
        dataset.output_language = config["output_language"]

    db.commit()
    return {
        "name": name,
        "config": {
            "reverse_target": dataset.reverse_target,
            "target_length": dataset.target_length,
            "reverse_style": dataset.reverse_style,
            "output_language": dataset.output_language,
        },
    }


def add_items(db: Session, name: str, items: list[tuple[str, bytes]]) -> dict:
    """将图片拷贝到数据集文件夹（跳过重名）/ Copy images into the dataset folder (skip duplicates)."""
    folder = _dataset_folder(name)
    if not folder.is_dir():
        raise ValueError(f"数据集不存在 / Dataset does not exist: {name}")
    dataset = _get_dataset_row(db, name)

    added: list[str] = []
    duplicates: list[str] = []
    for filename, content in items:
        safe = Path(filename).name
        if not safe or safe in (".", ".."):
            continue
        dest = folder / safe
        if dest.exists():
            duplicates.append(safe)
            continue
        dest.write_bytes(content)
        added.append(safe)

    if dataset is not None:
        _sync_items(db, dataset, folder)

    return {"added": added, "duplicates": duplicates}


def delete_items(db: Session, name: str, filenames: list[str]) -> dict:
    """删除数据集内选中的素材（图片 + 同名 .txt + DB 记录）/ Delete selected items (image + .txt + DB row)."""
    folder = _dataset_folder(name)
    if not folder.is_dir():
        raise ValueError(f"数据集不存在 / Dataset does not exist: {name}")
    dataset = _get_dataset_row(db, name)

    deleted: list[str] = []
    failed: list[str] = []
    for fname in filenames:
        safe = Path(fname).name
        if not safe or safe in (".", ".."):
            continue
        img = folder / safe
        txt = _prompt_txt_path(img)

        # 图片删除失败（被占用）时保留 DB 记录，避免磁盘与索引不一致
        # / if the image can't be removed (in use), keep the DB row so the
        # index stays consistent with the filesystem.
        if not _remove_file_robust(img):
            failed.append(safe)
            continue

        if txt.exists():
            _remove_file_robust(txt)
        if dataset is not None:
            db.query(DatasetItem).filter(
                DatasetItem.dataset_id == dataset.id,
                DatasetItem.filename == safe,
            ).delete()
        deleted.append(safe)

    db.commit()
    return {"deleted": deleted, "failed": failed}


def write_prompt(db: Session, name: str, filename: str, text: str) -> None:
    """将打标结果写入图片同名 .txt 并更新 DB 缓存 / Write tag result to the image's .txt and update DB cache."""
    folder = _dataset_folder(name)
    safe = Path(filename).name
    img = folder / safe
    _prompt_txt_path(img).write_text(text, encoding="utf-8")

    dataset = _get_dataset_row(db, name)
    if dataset is not None:
        item = (
            db.query(DatasetItem)
            .filter(DatasetItem.dataset_id == dataset.id, DatasetItem.filename == safe)
            .first()
        )
        if item is None:
            db.add(DatasetItem(dataset_id=dataset.id, filename=safe, prompt_text=text))
        else:
            item.prompt_text = text
        db.commit()


async def tag_image(engine, db: Session, name: str, filename: str) -> dict:
    """对数据集内单张图片打标（反推 → 写 txt → 更新 DB）/ Tag a single image in the dataset.

    即使图片已有打标数据也会重新打标覆盖（需求 4-1）。
    / Re-tags even if a prompt already exists (requirement 4-1).

    Args:
        engine: PromptEngine 实例 / PromptEngine instance.
        db: 数据库会话 / database session.
        name: 数据集名称 / dataset name.
        filename: 图片文件名 / image filename.

    Returns:
        打标结果 / tag result dict.
    """
    dataset = _get_dataset_row(db, name)
    if dataset is None:
        raise ValueError(f"数据集不存在 / Dataset does not exist: {name}")

    folder = _dataset_folder(name)
    safe = Path(filename).name
    img = folder / safe
    if not img.exists():
        raise FileNotFoundError(f"图片不存在 / Image does not exist: {safe}")

    skill, model_type = parse_reverse_target(dataset.reverse_target)
    extra = build_extra_context(
        skill_name=skill,
        model_type=model_type,
        target_length=dataset.target_length,
        reverse_style=dataset.reverse_style,
        output_language=dataset.output_language,
    )
    feature = "reverse" if skill else "reverse_reference"

    result = await engine.generate(
        feature=feature,
        skill_name=skill,
        user_text="",
        images=[str(img)],
        extra_context=extra,
    )

    text = result.text
    write_prompt(db, name, safe, text)

    return {
        "filename": safe,
        "prompt_text": text,
        "model_name": result.model_name,
    }


def resolve_image_path(name: str, filename: str) -> Path | None:
    """解析数据集内图片的绝对路径（拒绝路径穿越）/ Resolve an image path inside a dataset (rejects traversal)."""
    safe_name = Path(name).name
    if safe_name != name or not safe_name:
        return None
    safe_file = Path(filename).name
    if safe_file != filename or not safe_file or safe_file in (".", ".."):
        return None

    folder = consts.DATASETS_DIR / safe_name
    if not folder.is_dir():
        return None
    path = folder / safe_file
    if not path.is_file():
        return None
    return path
