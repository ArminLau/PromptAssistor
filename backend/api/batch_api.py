"""
F3: Batch Tagging API routes — dataset management + per-image tagging.
/ F3: 批量打标 API 路由 — 数据集管理 + 逐图打标。

The dataset list/detail endpoints manage dataset folders on disk and their
index cache in the DB. The tag endpoints run prompt reverse-engineering on
images using the dataset's persisted reverse configuration, writing results
to same-name .txt files.
/ 数据集列表/详情端点管理磁盘上的数据集文件夹及其数据库索引缓存；打标端点按数据集
持久化的反推配置对图片做提示词反推，并将结果写入同名 .txt 文件。
"""

import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.engine import PromptEngine
from db.database import get_db, get_session
from features import dataset_manager as dm
from utils.file_handler import get_mime_type

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request bodies / 请求体 ────────────────────────────────────────────────

class CreateDatasetBody(BaseModel):
    name: str


class RenameDatasetBody(BaseModel):
    new_name: str


class FilenamesBody(BaseModel):
    filenames: list[str]


class BatchTagBody(BaseModel):
    """批量打标请求体 / Batch-tag request body.

    `all=True` 时忽略 `filenames`，改为对数据集内全部图片打标。
    / When `all=True`, `filenames` is ignored and all images in the dataset are tagged.
    """
    filenames: list[str] = []
    all: bool = False


# ─── Dataset list & CRUD / 数据集列表与增删改 ───────────────────────────────

@router.get("/datasets")
async def list_datasets(search: str | None = None, db: Session = Depends(get_db)):
    """列出所有数据集，支持名称模糊搜索 / List datasets with optional fuzzy name search."""
    return {"success": True, "datasets": dm.list_datasets(db, search)}


@router.post("/datasets")
async def create_dataset(body: CreateDatasetBody, db: Session = Depends(get_db)):
    """创建新数据集 / Create a new dataset."""
    try:
        dataset = dm.create_dataset(db, body.name)
        return {"success": True, "dataset": dataset}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/datasets/{name}")
async def rename_dataset(name: str, body: RenameDatasetBody, db: Session = Depends(get_db)):
    """重命名数据集 / Rename a dataset."""
    try:
        dataset = dm.rename_dataset(db, name, body.new_name)
        return {"success": True, "dataset": dataset}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/datasets/{name}")
async def delete_dataset(name: str, db: Session = Depends(get_db)):
    """删除数据集及其全部文件与记录 / Delete a dataset with all its files and records."""
    try:
        dm.delete_dataset(db, name)
        return {"success": True, "message": f"Dataset {name} deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Dataset detail & config / 数据集详情与配置 ─────────────────────────────

@router.get("/datasets/{name}")
async def get_dataset_detail(
    name: str,
    page: int = 1,
    page_size: int = 12,
    db: Session = Depends(get_db),
):
    """获取数据集详情（配置 + 分页素材）/ Get dataset detail (config + paginated items)."""
    try:
        return {"success": True, **dm.get_dataset_detail(db, name, page, page_size)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/datasets/{name}/config")
async def update_dataset_config(name: str, config: dict, db: Session = Depends(get_db)):
    """更新数据集的反推配置 / Update a dataset's reverse config."""
    try:
        return {"success": True, **dm.update_dataset_config(db, name, config)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── Items: add / delete / tag / 素材增删与打标 ──────────────────────────────

@router.post("/datasets/{name}/items")
async def add_items(
    name: str,
    request: Request,
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """多选上传图片并拷贝到数据集文件夹 / Upload multiple images and copy them into the dataset."""
    items: list[tuple[str, bytes]] = []
    for f in files:
        if f.filename:
            items.append((f.filename, await f.read()))

    if not items:
        raise HTTPException(status_code=400, detail="未收到任何图片 / No images received")

    try:
        result = dm.add_items(db, name, items)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/datasets/{name}/items")
async def delete_items(name: str, body: FilenamesBody, db: Session = Depends(get_db)):
    """删除选中的素材（图片 + 同名 .txt + DB 记录）/ Delete selected items (image + .txt + DB row)."""
    try:
        result = dm.delete_items(db, name, body.filenames)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/datasets/{name}/items/{filename}/tag")
async def tag_single_item(request: Request, name: str, filename: str):
    """对单张图片打标（返回 JSON）/ Tag a single image (JSON response)."""
    engine = PromptEngine(request.app.state.skill_manager, request.app.state.model_manager)
    db = get_session()
    try:
        result = await dm.tag_image(engine, db, name, filename)
        return {"success": True, **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Tag item failed for {filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/datasets/{name}/tag")
async def batch_tag_items(request: Request, name: str, body: BatchTagBody):
    """对选中的多张图片批量打标（流式 NDJSON 逐图返回）/ Batch-tag selected images (streaming NDJSON).

    不区分是否已打标，选中的图片都会重新打标覆盖；`all=True` 时打标数据集内全部图片。
    / Re-tags all selected images regardless of existing tags; tags every image
    in the dataset when `all=True`.
    """
    engine = PromptEngine(request.app.state.skill_manager, request.app.state.model_manager)
    if body.all:
        try:
            filenames = dm.list_all_filenames(name)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        filenames = body.filenames

    async def stream_results():
        """逐图打标并即时产出结果 / Tag each image and yield its result as soon as it's ready."""
        for filename in filenames:
            db = get_session()
            try:
                result = await dm.tag_image(engine, db, name, filename)
                payload = {
                    "filename": result["filename"],
                    "result": result["prompt_text"],
                    "model_name": result["model_name"],
                }
            except Exception as e:
                logger.error(f"Batch tag failed for {filename}: {e}")
                payload = {"filename": filename, "error": str(e)}
            finally:
                db.close()
            yield json.dumps(payload, ensure_ascii=False) + "\n"

    return StreamingResponse(
        stream_results(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Image serving / 图片静态服务 ───────────────────────────────────────────

@router.get("/datasets/{name}/files/{filename}")
async def serve_image(name: str, filename: str):
    """返回数据集内图片（严格路径校验防穿越）/ Serve an image inside a dataset (traversal-safe)."""
    path = dm.resolve_image_path(name, filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Image not found / 图片不存在")
    return FileResponse(path, media_type=get_mime_type(path))
