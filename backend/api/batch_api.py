"""
F3: Batch Tagging API routes.
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, Request, UploadFile

from core.engine import PromptEngine

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory batch task tracker (will be replaced with DB-backed in production)
_batch_tasks: dict[str, dict[str, Any]] = {}


@router.post("/tag")
async def batch_tag(
    request: Request,
    skill_name: str = Form(...),
    user_text: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    extra_context: str = Form(default=""),
):
    """
    Start a batch tagging task for multiple files.

    Returns a task_id for tracking progress.
    """
    task_id = str(uuid.uuid4())[:8]

    # Save uploaded files
    import tempfile
    from pathlib import Path

    temp_dir = Path(tempfile.mkdtemp())
    file_paths: list[str] = []

    for f in files:
        if f.filename:
            file_path = temp_dir / f.filename
            content = await f.read()
            file_path.write_bytes(content)
            file_paths.append(str(file_path))

    # Record task
    _batch_tasks[task_id] = {
        "status": "processing",
        "total": len(file_paths),
        "completed": 0,
        "results": [],
    }

    # Process (simplified - in production this would be a background task)
    # For now, process synchronously for small batches
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager
    engine = PromptEngine(skill_manager, model_manager)

    try:
        batch_items = [
            {"user_text": user_text, "images": [fp], "extra_context": extra_context}
            for fp in file_paths
        ]

        results = await engine.generate_batch(
            feature="batch",
            skill_name=skill_name,
            items=batch_items,
        )

        _batch_tasks[task_id]["status"] = "completed"
        _batch_tasks[task_id]["completed"] = len(results)
        _batch_tasks[task_id]["results"] = [
            {"text": r.text, "model": r.model_name} for r in results
        ]

        return {
            "success": True,
            "task_id": task_id,
            "total": len(results),
            "results": _batch_tasks[task_id]["results"],
        }
    except Exception as e:
        _batch_tasks[task_id]["status"] = "error"
        logger.error(f"Batch tagging failed: {e}")
        return {"success": False, "error": str(e), "task_id": task_id}


@router.get("/status/{task_id}")
async def get_batch_status(task_id: str):
    """Get the status of a batch tagging task."""
    task = _batch_tasks.get(task_id)
    if task is None:
        return {"success": False, "error": "Task not found"}
    return {"success": True, **task}
