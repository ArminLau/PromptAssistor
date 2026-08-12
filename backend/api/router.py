"""
API router aggregator for PromptAssistor.

Collects all API route modules into a single router.
"""

from fastapi import APIRouter

# Create the main API router
api_router = APIRouter()

# Import and include sub-routers
from .model_api import router as model_router
from .config_api import router as config_router
from .reverse_api import router as reverse_router
from .expand_api import router as expand_router
from .batch_api import router as batch_router
from .library_api import router as library_router
from .skill_api import router as skill_router
from .system_api import router as system_router

api_router.include_router(model_router, prefix="/models", tags=["Models"])
api_router.include_router(config_router, prefix="/config", tags=["Config"])
api_router.include_router(reverse_router, prefix="/reverse", tags=["Reverse"])
api_router.include_router(expand_router, prefix="/expand", tags=["Expand"])
api_router.include_router(batch_router, prefix="/batch", tags=["Batch"])
api_router.include_router(library_router, prefix="/library", tags=["Library"])
api_router.include_router(skill_router, prefix="/skills", tags=["Skills"])
api_router.include_router(system_router, prefix="/system", tags=["System"])
