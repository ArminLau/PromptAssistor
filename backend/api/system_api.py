"""
System API routes — system check, logs, workspace info.
/ 系统API路由 — 系统检查、日志、工作空间信息。
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Request

import app.constants as consts
from app.constants import DEFAULT_LOG_PATH
from utils.system_check import check_all, check_summary

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/check")
async def system_check(request: Request):
    """
    Run all system checks and return results.
    / 运行所有系统检查并返回结果。
    """
    config = request.app.state.config
    model_manager = getattr(request.app.state, 'model_manager', None)

    results = check_all(config, model_manager)
    summary = check_summary(results)
    return summary


@router.get("/workspace")
async def workspace_info(request: Request):
    """
    Get current workspace information.
    / 获取当前工作空间信息。
    """
    ws_manager = getattr(request.app.state, 'workspace_manager', None)
    if ws_manager is None:
        return {"enabled": False, "message": "Workspace manager not initialized / 工作空间管理器未初始化"}
    return ws_manager.get_workspace_info()


@router.get("/logs")
async def get_recent_logs(lines: int = 100):
    """
    Get recent application log entries.
    / 获取最近的应用程序日志条目。

    Args:
        lines: Number of recent log lines to return / 返回的日志行数。
    """
    log_path = DEFAULT_LOG_PATH
    if not log_path.exists():
        return {"logs": [], "message": "Log file not found / 日志文件未找到"}

    try:
        with open(log_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
        recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
        return {"logs": [l.strip() for l in recent], "total_lines": len(all_lines)}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@router.get("/env")
async def environment_info():
    """
    Get basic environment information for debugging.
    / 获取基本环境信息用于调试。
    """
    import sys
    import platform

    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "processor": platform.processor(),
        "python_executable": sys.executable,
        "cwd": str(Path.cwd()),
    }


@router.post("/select-folder")
async def select_folder(request: Request):
    """
    Open a native folder picker dialog and return the selected path.
    / 打开系统原生文件夹选择对话框，返回选中的路径。

    Uses PowerShell on Windows (no extra deps), osascript on macOS.
    / Windows使用PowerShell（零依赖），macOS使用osascript。

    Returns:
        {"success": true, "path": "/selected/path"}
        or {"success": false, "message": "..."} if cancelled/error.
    """
    import os
    import subprocess
    import sys

    initial_dir = os.environ.get("PROMPTASSISTOR_HOME", str(Path.home()))

    try:
        if sys.platform == "win32":
            # Use PowerShell + .NET FolderBrowserDialog / 使用PowerShell原生对话框
            ps_script = f'''Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "选择工作空间目录 / Select Workspace Directory"
$dialog.SelectedPath = "{initial_dir}"
$dialog.ShowNewFolderButton = $true
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {{
    Write-Output $dialog.SelectedPath
}}'''
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True, text=True, timeout=60,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0,
            )
            selected = result.stdout.strip()
            if selected:
                return {"success": True, "path": str(Path(selected).resolve())}
            else:
                return {"success": False, "message": "No folder selected / 未选择文件夹"}

        elif sys.platform == "darwin":
            # macOS: use osascript / 使用AppleScript
            script = f'''
tell application "System Events"
    activate
    set folderPath to POSIX path of (choose folder with prompt "选择工作空间目录 / Select Workspace Directory" default location "{initial_dir}")
end tell'''
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=60,
            )
            selected = result.stdout.strip()
            if selected:
                return {"success": True, "path": str(Path(selected).resolve())}
            else:
                return {"success": False, "message": "No folder selected / 未选择文件夹"}

        else:
            # Linux fallback: try zenity / Linux后备：尝试zenity
            result = subprocess.run(
                ["zenity", "--file-selection", "--directory",
                 "--title=选择工作空间目录 / Select Workspace Directory",
                 f"--filename={initial_dir}"],
                capture_output=True, text=True, timeout=60,
            )
            selected = result.stdout.strip()
            if selected and result.returncode == 0:
                return {"success": True, "path": str(Path(selected).resolve())}
            else:
                return {"success": False, "message": "No folder selected / 未选择文件夹"}

    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Folder selection timed out / 选择超时"}
    except Exception as e:
        logger.error(f"Folder picker failed / 文件夹选择失败: {e}")
        return {"success": False, "message": str(e)}


@router.get("/models/scan")
async def scan_models():
    """
    Scan the models directory for available GGUF and mmproj files.
    / 扫描models目录，返回可用的GGUF和mmproj文件列表。

    Returns structured list suitable for dropdown selection.
    / 返回结构化列表，适合用于下拉选择。

    Uses dynamic attribute access to get workspace-overridden MODELS_DIR.
    / 使用动态属性访问获取工作空间覆盖后的 MODELS_DIR。
    """
    # 动态访问以获取工作空间覆盖后的最新值
    # Dynamic access to get workspace-overridden value
    models_dir = consts.MODELS_DIR

    result = {
        "models_dir": str(models_dir),
        "models": [],       # list of GGUF model files
        "mmproj": [],       # list of mmproj projector files
        "pairs": [],        # auto-matched model+mmproj pairs
    }

    if not models_dir.exists():
        return result

    # Scan for .gguf files recursively / 递归扫描.gguf文件
    gguf_files = []
    mmproj_files = []

    for f in sorted(models_dir.rglob("*.gguf")):
        rel_path = str(f.relative_to(models_dir))
        size_mb = f.stat().st_size / (1024 * 1024)
        if "mmproj" in f.name.lower():
            mmproj_files.append({
                "name": f.name,
                "path": str(f),
                "relative_path": rel_path,
                "size_mb": round(size_mb, 1),
            })
        else:
            gguf_files.append({
                "name": f.name,
                "path": str(f),
                "relative_path": rel_path,
                "size_mb": round(size_mb, 1),
                "parent_dir": f.parent.name,  # model folder name
            })

    result["models"] = gguf_files
    result["mmproj"] = mmproj_files

    # Auto-match models with their mmproj in same folder
    # / 自动配对同文件夹下的模型和投影器
    for model in gguf_files:
        model_dir = str(Path(model["path"]).parent)
        matching_mmproj = [
            m for m in mmproj_files
            if str(Path(m["path"]).parent) == model_dir
        ]
        if matching_mmproj:
            result["pairs"].append({
                "model": model,
                "mmproj": matching_mmproj[0],
            })

    return result
