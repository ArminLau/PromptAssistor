"""
F4: Prompt Library API routes.

CRUD operations for managing saved prompts in the user's library.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Prompt

logger = logging.getLogger(__name__)

router = APIRouter()


class PromptCreate(BaseModel):
    title: str = "Untitled"
    content: str = ""
    model_name: str = ""
    category: str = "General"
    tags: list[str] = []
    source_type: str = "manual"
    source_media: list[str] = []
    notes: str = ""


class PromptUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    model_name: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_favorite: bool | None = None
    notes: str | None = None


@router.get("")
async def list_prompts(
    request: Request,
    category: str | None = None,
    model_name: str | None = None,
    is_favorite: bool | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List saved prompts with optional filters."""
    query = db.query(Prompt)

    if category:
        query = query.filter(Prompt.category == category)
    if model_name:
        query = query.filter(Prompt.model_name == model_name)
    if is_favorite is not None:
        query = query.filter(Prompt.is_favorite == is_favorite)
    if search:
        query = query.filter(
            (Prompt.title.contains(search)) | (Prompt.content.contains(search))
        )

    total = query.count()
    prompts = query.order_by(Prompt.updated_at.desc()).offset(offset).limit(limit).all()

    return {
        "success": True,
        "total": total,
        "limit": limit,
        "offset": offset,
        "prompts": [p.to_dict() for p in prompts],
    }


@router.post("")
async def create_prompt(body: PromptCreate, db: Session = Depends(get_db)):
    """Save a new prompt to the library."""
    prompt = Prompt(
        title=body.title,
        content=body.content,
        model_name=body.model_name,
        category=body.category,
        source_type=body.source_type,
        notes=body.notes,
    )
    prompt.set_tags(body.tags)

    import json
    prompt.source_media = json.dumps(body.source_media, ensure_ascii=False)

    db.add(prompt)
    db.commit()
    db.refresh(prompt)

    return {"success": True, "prompt": prompt.to_dict()}


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    """Get a single prompt by ID."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"success": True, "prompt": prompt.to_dict()}


@router.put("/{prompt_id}")
async def update_prompt(prompt_id: int, body: PromptUpdate, db: Session = Depends(get_db)):
    """Update an existing prompt."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    update_data = body.model_dump(exclude_unset=True)
    if "tags" in update_data and update_data["tags"] is not None:
        prompt.set_tags(update_data.pop("tags"))

    for key, value in update_data.items():
        setattr(prompt, key, value)

    db.commit()
    db.refresh(prompt)
    return {"success": True, "prompt": prompt.to_dict()}


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    """Delete a prompt from the library."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    db.delete(prompt)
    db.commit()
    return {"success": True, "message": f"Prompt {prompt_id} deleted"}


@router.get("/search/tags")
async def get_all_tags(db: Session = Depends(get_db)):
    """Get all unique tags across all prompts."""
    prompts = db.query(Prompt.tags).all()
    all_tags: set[str] = set()
    import json

    for (tags_json,) in prompts:
        try:
            tags = json.loads(tags_json) if tags_json else []
            all_tags.update(tags)
        except (json.JSONDecodeError, TypeError):
            pass

    return {"success": True, "tags": sorted(all_tags)}


@router.get("/search/categories")
async def get_all_categories(db: Session = Depends(get_db)):
    """Get all unique categories."""
    categories = db.query(Prompt.category).distinct().all()
    return {
        "success": True,
        "categories": sorted([c[0] for c in categories if c[0]]),
    }
