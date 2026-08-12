"""
Configuration API routes.
/ 配置API路由。
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.constants import ProviderType

logger = logging.getLogger(__name__)

router = APIRouter()

# 有效的 provider 类型列表 / Valid provider type list
VALID_PROVIDER_TYPES = {pt.value for pt in ProviderType}


@router.get("")
async def get_config(request: Request):
    """Get the full application configuration / 获取完整应用配置。"""
    import os

    config = request.app.state.config
    result = config.get_all()

    # 自动修复无效的 active_provider（如旧版本残留的 "workspace"）
    # Auto-fix invalid active_provider (e.g. leftover "workspace" from old versions)
    active = result.get("active_provider")
    if active not in VALID_PROVIDER_TYPES:
        logger.warning(
            f"Fixing invalid active_provider / 修复无效的active_provider: "
            f"'{active}' → '{ProviderType.ONLINE.value}'"
        )
        result["active_provider"] = ProviderType.ONLINE.value
        config.set("active_provider", ProviderType.ONLINE.value)
        config.save()

    # 注入应用主目录，供前端作为默认工作空间路径
    # Inject app home directory for frontend default workspace path
    app_home = os.environ.get("PROMPTASSISTOR_HOME", "")
    if not app_home:
        from pathlib import Path
        # 回退：constants 中的项目根目录 / Fallback: project root from constants
        from app.constants import PROJECT_ROOT
        app_home = str(PROJECT_ROOT)
    result["app_home"] = app_home

    return result


@router.put("")
async def update_config(request: Request, config_data: dict):
    """
    Update application configuration.
    / 更新应用配置。

    Validates provider types to prevent invalid values like "workspace".
    / 验证 provider 类型以防止无效值（如"workspace"）。
    """
    config = request.app.state.config

    # 校验 active_provider 类型 / Validate active_provider type
    if "active_provider" in config_data:
        provider_type = config_data["active_provider"]
        if provider_type not in VALID_PROVIDER_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid provider type / 无效的 provider 类型: '{provider_type}'. "
                    f"Must be one of / 必须是以下之一: {', '.join(sorted(VALID_PROVIDER_TYPES))}"
                ),
            )

    # 校验 providers 键名 — 防止写入 "workspace" 等无效 provider
    # Validate provider keys — prevent writing invalid entries like "workspace"
    if "providers" in config_data:
        providers_data: dict[str, Any] = config_data["providers"]
        for key in providers_data:
            if key not in VALID_PROVIDER_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Invalid provider key / 无效的 provider 键: '{key}'. "
                        f"Must be one of / 必须是以下之一: {', '.join(sorted(VALID_PROVIDER_TYPES))}"
                    ),
                )

    # Update nested config values / 更新嵌套配置值
    for key, value in config_data.items():
        config.set(key, value)

    config.save()

    # 如果工作空间配置变更，重新应用工作空间以更新路径常量
    # If workspace config changed, re-apply workspace to update path constants
    # Note: 前端使用扁平键(workspace.enabled/workspace.path)发送，需检查前缀
    # The frontend sends flat keys (workspace.enabled/workspace.path), check prefix
    has_workspace_change = any(
        k == "workspace" or k.startswith("workspace.") for k in config_data
    )
    if has_workspace_change:
        ws_manager = getattr(request.app.state, 'workspace_manager', None)
        if ws_manager is not None:
            ws_info = ws_manager.apply_workspace()
            logger.info(
                f"Workspace re-applied after config update / 配置更新后重新应用工作空间: "
                f"enabled={ws_info.get('enabled')}, path={ws_info.get('path')}"
            )

    return {"success": True, "message": "Configuration updated / 配置已更新"}
