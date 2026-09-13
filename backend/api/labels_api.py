"""
F6: Reference tag library API routes — category & tag CRUD + preview serving.
/ F6: 参考标签库 API 路由 — 分类与标签增删改 + 预览图服务。

The category hierarchy is an arbitrary-depth tree of folders under the labels
directory; tag metadata lives in the DB (label_tags) with a same-name .txt
mirror on disk. These endpoints maintain both atomically. Paths are passed as
query parameters or JSON bodies (not URL path segments) to avoid ambiguity with
`/` separators.
/ 分类层级是 labels 目录下的任意深度文件夹树；标签元数据存于数据库，并在磁盘上同步一份同名
.txt。这些端点原子地维护二者。路径通过查询参数或 JSON 请求体传递（而非 URL 路径段），以避免
与 `/` 分隔符冲突。
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from features import labels_manager as lm
from utils.file_handler import get_mime_type

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request bodies / 请求体 ────────────────────────────────────────────────

class CreateCategoryBody(BaseModel):
    parent_path: str = ""          # 父分类路径 / parent category path
    name: str                      # 新分类名 / new category name


class RenameCategoryBody(BaseModel):
    path: str                      # 分类路径 / category path
    new_name: str                  # 新分类名 / new category name


class CreateTagBody(BaseModel):
    path: str                      # 父分类路径 / parent category path
    name: str                      # 标签名 / tag name
    content: str = ""              # 内容 / content
    note: str = ""                 # 备注 / note


class UpdateTagBody(BaseModel):
    path: str                      # 父分类路径 / parent category path
    name: str                      # 当前标签名 / current tag name
    new_name: str | None = None    # 新标签名（改名）/ new tag name (rename)
    content: str | None = None     # 内容 / content
    note: str | None = None        # 备注 / note


# ─── Tree / 树 ─────────────────────────────────────────────────────────────

@router.get("/tree")
async def get_tree(db: Session = Depends(get_db)):
    """返回标签库完整树 / Return the full tag library tree."""
    return {"success": True, "tree": lm.get_tree(db)}


# ─── Category CRUD / 分类增删改 ─────────────────────────────────────────────

@router.post("/categories")
async def create_category(body: CreateCategoryBody):
    """在指定父分类下创建子分类 / Create a sub-category under a parent category."""
    try:
        return {"success": True, **lm.create_category(body.parent_path, body.name)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/categories")
async def rename_category(body: RenameCategoryBody, db: Session = Depends(get_db)):
    """重命名分类 / Rename a category."""
    try:
        return {"success": True, **lm.rename_category(db, body.path, body.new_name)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/categories")
async def delete_category(path: str, db: Session = Depends(get_db)):
    """删除分类及其全部后代标签 / Delete a category and all its descendant tags."""
    try:
        lm.delete_category(db, path)
        return {"success": True, "message": f"Category {path} deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Tag CRUD / 标签增删改 ──────────────────────────────────────────────────

@router.post("/tags")
async def create_tag(body: CreateTagBody, db: Session = Depends(get_db)):
    """创建标签（DB + txt 双写）/ Create a tag (DB + txt)."""
    try:
        tag = lm.create_tag(db, body.path, body.name, body.content, body.note)
        return {"success": True, "tag": tag}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/tags")
async def update_tag(body: UpdateTagBody, db: Session = Depends(get_db)):
    """更新标签（内容/备注/改名）/ Update a tag (content/note/rename)."""
    fields = {k: v for k, v in body.model_dump().items() if v is not None and k in ("new_name", "content", "note")}
    # 改名字段统一映射到 name / map the rename field to name
    if "new_name" in fields:
        fields["name"] = fields.pop("new_name")
    try:
        tag = lm.update_tag(db, body.path, body.name, fields)
        return {"success": True, "tag": tag}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/tags")
async def delete_tag(path: str, name: str, db: Session = Depends(get_db)):
    """删除标签 / Delete a tag."""
    try:
        lm.delete_tag(db, path, name)
        return {"success": True, "message": f"Tag {name} deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Preview serving / 预览图服务 ───────────────────────────────────────────

@router.get("/files")
async def serve_preview(path: str, name: str):
    """返回标签同名预览图（严格路径校验防穿越）/ Serve a tag's same-name preview image (traversal-safe)."""
    resolved = lm.resolve_preview_path(path, name)
    if resolved is None:
        raise HTTPException(status_code=404, detail="Preview not found / 预览图不存在")
    return FileResponse(resolved, media_type=get_mime_type(resolved))
