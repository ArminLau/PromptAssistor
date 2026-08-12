"""
F5: Skill Maintenance API routes.

Endpoints for viewing skill details and saving custom skill overrides.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.skill_manager import SkillNotFoundError
from db.database import get_db
from db.models import SkillOverride

logger = logging.getLogger(__name__)

router = APIRouter()


class SkillOverrideCreate(BaseModel):
    skill_name: str
    override_content: str
    description: str = ""


@router.get("")
async def list_skills(request: Request):
    """List all available skills with their details."""
    skill_manager = request.app.state.skill_manager

    # Get skill overrides from DB
    db = next(get_db())
    try:
        overrides = db.query(SkillOverride).all()
        override_map = {o.skill_name: o.to_dict() for o in overrides}
    finally:
        db.close()

    skills = skill_manager.list_skills()
    for skill in skills:
        skill["has_override"] = skill["name"] in override_map

    return {"success": True, "skills": skills}


@router.get("/{skill_name}")
async def get_skill(request: Request, skill_name: str, db: Session = Depends(get_db)):
    """Get full details of a skill, including any custom override."""
    skill_manager = request.app.state.skill_manager

    try:
        skill = skill_manager.get_skill(skill_name)
        skill_data = skill.to_dict()
    except SkillNotFoundError:
        raise HTTPException(status_code=404, detail=f"Skill not found: {skill_name}")

    # Check for override
    override = db.query(SkillOverride).filter(
        SkillOverride.skill_name == skill_name
    ).first()

    if override:
        skill_data["has_override"] = True
        skill_data["override_content"] = override.override_content
        skill_data["override_description"] = override.description
    else:
        skill_data["has_override"] = False

    return {"success": True, "skill": skill_data}


@router.put("/{skill_name}")
async def save_skill_override(
    skill_name: str,
    body: SkillOverrideCreate,
    db: Session = Depends(get_db),
):
    """Create or update a skill override."""
    # Verify skill exists
    # (We don't have direct access to skill_manager here in a clean way,
    #  but the override can reference any skill name for future skills)

    override = db.query(SkillOverride).filter(
        SkillOverride.skill_name == skill_name
    ).first()

    if override:
        override.override_content = body.override_content
        override.description = body.description
    else:
        override = SkillOverride(
            skill_name=skill_name,
            override_content=body.override_content,
            description=body.description,
        )
        db.add(override)

    db.commit()
    db.refresh(override)

    return {"success": True, "override": override.to_dict()}


@router.delete("/{skill_name}")
async def delete_skill_override(skill_name: str, db: Session = Depends(get_db)):
    """Delete a skill override, reverting to the original skill."""
    override = db.query(SkillOverride).filter(
        SkillOverride.skill_name == skill_name
    ).first()

    if not override:
        raise HTTPException(status_code=404, detail="Override not found")

    db.delete(override)
    db.commit()
    return {"success": True, "message": f"Override for '{skill_name}' deleted"}
