"""
FastAPI application entry point for PromptAssistor backend.
/ PromptAssistor 后端 FastAPI 应用入口。

The backend serves both the REST API and the React frontend static files.
/ 后端同时提供 REST API 和 React 前端静态文件服务。
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure backend/ is in sys.path for imports / 确保backend/在导入路径中
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import ConfigManager
from app.constants import API_PREFIX, DEFAULT_PORT, DEFAULT_STATIC_DIR

logger = logging.getLogger(__name__)

# Configuration / 配置初始化
config = ConfigManager()

# Static files directory (frontend build output) / 前端构建产物目录
# In frozen mode this points to embedded sys._MEIPASS/static
# / 在frozen模式下指向嵌入的sys._MEIPASS/static
STATIC_DIR = DEFAULT_STATIC_DIR


# Application Lifespan / 应用生命周期
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events / 应用启动和关闭事件。"""
    logger.info("=" * 50)
    logger.info("PromptAssistor backend starting up... / 后端启动中...")
    logger.info("=" * 50)

    # 1. Apply workspace / 应用工作空间配置
    from core.workspace_manager import WorkspaceManager
    workspace_manager = WorkspaceManager(config)
    ws_info = workspace_manager.apply_workspace()
    if ws_info.get("enabled"):
        logger.info(f"Workspace: {ws_info['path']} / 工作空间: {ws_info['path']}")
    app.state.workspace_manager = workspace_manager

    # 2. Run system checks / 运行系统检查
    from utils.system_check import check_all, check_summary
    logger.info("Running system checks... / 运行系统检查...")
    check_results = check_all(config)
    summary = check_summary(check_results)
    app.state.system_check_results = check_results
    app.state.system_check_summary = summary

    for r in check_results:
        if r["status"] != "ok":
            logger.warning(f"[{r['status'].upper()}] {r['name']}: {r['message']}")

    if summary["all_ok"]:
        logger.info("All system checks passed / 所有系统检查通过")
    else:
        logger.warning(
            f"System checks: {summary['ok_count']} OK, "
            f"{summary['warning_count']} warnings, {summary['error_count']} errors"
        )

    # 3. Initialize database / 初始化数据库
    from db.database import init_db
    init_db()

    # 4. Initialize managers / 初始化管理器
    from core.skill_manager import SkillManager
    from core.model_manager import ModelManager

    skill_manager = SkillManager()
    skill_manager.discover()

    model_manager = ModelManager()
    try:
        await model_manager.initialize()
    except Exception as e:
        logger.warning(f"Model init deferred / 模型初始化延迟: {e}")

    app.state.skill_manager = skill_manager
    app.state.model_manager = model_manager
    app.state.config = config

    port = config.get("port", DEFAULT_PORT)
    logger.info(f"Backend ready / 后端就绪: http://127.0.0.1:{port}")
    logger.info(f"API docs / API文档: http://127.0.0.1:{port}/docs")
    logger.info(f"Frontend / 前端: http://127.0.0.1:{port}")

    yield

    # Shutdown / 关闭
    logger.info("PromptAssistor backend shutting down... / 后端关闭中...")
    await model_manager.shutdown()


# Application Creation / 应用创建
def create_app() -> FastAPI:
    """Create and configure the FastAPI application / 创建并配置FastAPI应用。"""
    app = FastAPI(
        title="PromptAssistor",
        description="AI Prompt Generation Assistant - Backend API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS / 跨域
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes / 注册API路由
    from api.router import api_router
    app.include_router(api_router, prefix=API_PREFIX)

    # Health check / 健康检查
    @app.get("/health")
    async def health_check():
        return {
            "status": "ok",
            "version": "0.1.0",
            "active_provider": config.get("active_provider"),
            "workspace_enabled": config.get("workspace.enabled", False),
        }

    # System check / 系统检查
    @app.get("/system-check")
    async def system_check():
        from utils.system_check import check_all, check_summary
        model_manager = getattr(app.state, 'model_manager', None)
        results = check_all(config, model_manager)
        summary = check_summary(results)
        return summary

    # 挂载前端静态文件与 SPA 回退 / mount frontend static files + SPA fallback
    if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
        # 静态资源（Vite 产物位于 assets/ 下，如 JS/CSS）
        # / mount static assets (Vite output lives under assets/, e.g. JS/CSS)
        assets_dir = STATIC_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        index_file = STATIC_DIR / "index.html"

        # SPA 回退：前端使用 BrowserRouter，路由（如 /reverse）刷新时浏览器会
        # 请求对应路径，服务端需返回 index.html 让前端路由接管，否则刷新报 404。
        # / SPA fallback: the frontend uses BrowserRouter; on refresh the browser
        # requests the client-side route (e.g. /reverse), so return index.html
        # here and let the router take over — otherwise refresh yields 404.
        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):
            # 不劫持 API 前缀，让未知 API 端点仍返回 404 JSON
            # / do not hijack the API prefix — unknown API endpoints still 404
            if full_path == "api" or full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
            # 请求真实存在的静态文件时直接返回（如 favicon、根级文件）
            # / serve real static files directly (e.g. favicon, root-level files)
            candidate = STATIC_DIR / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(index_file)

        logger.info(f"Static files mounted from: {STATIC_DIR} (SPA fallback enabled)")
    else:
        logger.warning(f"Static dir not found, API-only mode: {STATIC_DIR}")
        @app.get("/")
        async def root():
            return {
                "message": "PromptAssistor API is running",
                "docs": "/docs",
                "health": "/health",
                "system_check": "/system-check",
                "note": "Frontend not built. Run: cd frontend && npx vite build",
            }

    return app


# Application Instance / 应用实例
app = create_app()
