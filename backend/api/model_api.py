"""
Model management API routes — list models, switch provider, test connections.
/ 模型管理API路由 — 列出模型、切换后端、测试连接。
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.constants import ProviderType

logger = logging.getLogger(__name__)

router = APIRouter()

# 有效的 provider 类型列表 / Valid provider types
VALID_PROVIDER_TYPES = {pt.value for pt in ProviderType}


@router.get("")
async def list_models(request: Request):
    """List all available models (skills) and provider status / 列出所有可用模型和后端状态。"""
    skill_manager = request.app.state.skill_manager
    model_manager = request.app.state.model_manager

    skills = skill_manager.list_skills()
    provider_info = model_manager.get_active_provider_info()

    return {"skills": skills, "provider": provider_info}


@router.get("/active")
async def get_active_model(request: Request):
    """Get the currently active provider info / 获取当前活跃后端信息。"""
    model_manager = request.app.state.model_manager
    return model_manager.get_active_provider_info()


@router.put("/active")
async def switch_provider(
    request: Request,
    provider_type: str = Query(..., description="Provider type: local, online, ollama"),
):
    """
    Switch the active LLM provider / 切换活跃的LLM后端。

    Args:
        provider_type: One of 'local', 'online', 'ollama' / 后端类型。
    """
    model_manager = request.app.state.model_manager

    if provider_type not in VALID_PROVIDER_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid provider / 无效的后端类型: '{provider_type}'. "
                f"Must be one of / 必须是以下之一: {', '.join(sorted(VALID_PROVIDER_TYPES))}"
            ),
        )

    try:
        success = await model_manager.switch_provider(provider_type)
        if success:
            return {
                "success": True,
                "active_provider": provider_type,
                "message": f"Switched to {provider_type} / 已切换到 {provider_type}",
            }
        else:
            # 切换失败（如缺少依赖），返回200但标记失败，前端据此显示错误
            # Switch failed (e.g., missing deps), return 200 with success=false
            return {
                "success": False,
                "active_provider": model_manager.get_active_provider_info().get("active", {}).get("type", ""),
                "message": (
                    f"Cannot switch to {provider_type} / 无法切换到 {provider_type}. "
                    f"Required packages may not be installed / 可能缺少必要的依赖包."
                ),
            }
    except Exception as e:
        logger.warning(f"Provider switch failed / 后端切换失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Switch failed / 切换失败: {str(e)}. "
                   f"The provider may need additional packages. Run: pip install -r backend/requirements.txt",
        )


@router.post("/test")
async def test_provider(
    request: Request,
    provider_type: str = Query(..., description="Provider type to test / 要测试的后端类型"),
):
    """
    Test if a provider is available and working / 测试后端是否可用。
    """
    model_manager = request.app.state.model_manager

    if provider_type not in ("local", "online", "ollama"):
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider_type}")

    try:
        result = await model_manager.test_provider(provider_type)
        return result
    except Exception as e:
        logger.warning(f"Provider test failed / 后端测试失败: {e}")
        return {"success": False, "message": str(e)}
