"""
System environment checker for PromptAssistor.
/ 系统环境检查工具，用于验证运行环境是否满足要求。

Checks Python version, dependencies, model availability, and config validity.
/ 检查Python版本、依赖、模型可用性和配置有效性。
"""

import importlib
import logging
import sys
from pathlib import Path
from typing import Any

# 注意: 不能在此处直接 import MODELS_DIR / SKILLS_DIR 等可变常量
# 因为它们会在 workspace_manager.apply_workspace() 时被更新，
# 而该函数在 lifespan 启动阶段才调用（晚于模块导入时间）。
# 使用 import app.constants 然后通过属性访问以获取最新值。
# Note: Do NOT import MODELS_DIR/SKILLS_DIR directly here, as these
# mutable constants are updated by workspace_manager.apply_workspace()
# during the lifespan startup, which runs AFTER module import time.
# Instead, access them via app.constants.<name> to get the current value.
import app.constants as consts
from app.constants import MIN_PYTHON_VERSION, SystemStatus
from utils.cuda_dll import setup_cuda_dll_search

logger = logging.getLogger(__name__)


def check_all(config: Any, model_manager=None) -> list[dict[str, Any]]:
    """
    Run all system checks and return results.
    / 运行所有系统检查并返回结果。

    Args / 参数:
        config: ConfigManager instance / 配置管理器实例。
        model_manager: Optional ModelManager for provider checks / 可选的模型管理器。

    Returns / 返回:
        List of check result dicts with: name, status, message, detail, fix
        / 检查结果列表，每项包含: name, status, message, detail, fix
    """
    results: list[dict[str, Any]] = []

    results.append(_check_python_version())
    results.append(_check_dependencies())
    results.append(_check_skills_dir())
    results.append(_check_models_dir())
    results.append(_check_config(config))

    if model_manager:
        results.append(_check_active_provider(model_manager))

    return results


def check_summary(check_results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Generate a summary of system check results.
    / 生成系统检查结果摘要。

    Returns / 返回:
        Dict with overall_status, ok_count, warning_count, error_count, results.
    """
    errors = [r for r in check_results if r["status"] == SystemStatus.ERROR.value]
    warnings = [r for r in check_results if r["status"] == SystemStatus.WARNING.value]
    ok = [r for r in check_results if r["status"] == SystemStatus.OK.value]

    if errors:
        overall = SystemStatus.ERROR.value
    elif warnings:
        overall = SystemStatus.WARNING.value
    else:
        overall = SystemStatus.OK.value

    return {
        "overall_status": overall,
        "ok_count": len(ok),
        "warning_count": len(warnings),
        "error_count": len(errors),
        "all_ok": len(errors) == 0 and len(warnings) == 0,
        "results": check_results,
    }


def _check_python_version() -> dict[str, Any]:
    """Check Python version meets minimum requirement / 检查Python版本是否满足最低要求。"""
    current = sys.version_info[:2]
    ok = current >= MIN_PYTHON_VERSION
    return {
        "name": "Python Version / Python版本",
        "status": SystemStatus.OK.value if ok else SystemStatus.ERROR.value,
        "message": f"Python {current[0]}.{current[1]} ({'OK' if ok else 'Need ' + '.'.join(map(str,MIN_PYTHON_VERSION))})",
        "detail": f"Current: {sys.version}\nRequired: >= {MIN_PYTHON_VERSION[0]}.{MIN_PYTHON_VERSION[1]}",
        "fix": f"请安装Python {MIN_PYTHON_VERSION[0]}.{MIN_PYTHON_VERSION[1]}+ / Install Python {MIN_PYTHON_VERSION[0]}.{MIN_PYTHON_VERSION[1]}+" if not ok else "",
    }


def _check_dependencies() -> dict[str, Any]:
    """Check that key Python packages are installed / 检查关键Python包是否已安装。"""
    required_packages = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
        ("PIL", "Pillow"),
        ("yaml", "PyYAML"),
        ("pydantic", "pydantic"),
        ("httpx", "httpx"),
    ]
    optional_packages = [
        ("llama_cpp", "llama-cpp-python"),
        ("openai", "openai"),
        ("ollama", "ollama"),
        ("cv2", "opencv-python"),
    ]

    missing_required = []
    for module, package in required_packages:
        try:
            importlib.import_module(module)
        except ImportError:
            missing_required.append(package)

    # 在导入 llama_cpp 之前准备 CUDA DLL 搜索路径
    # （否则 ggml-cuda.dll 依赖的 cublas/nvcudart DLL 找不到，import 会抛出 RuntimeError）
    # Prepare CUDA DLL search path before importing llama_cpp
    # (otherwise ggml-cuda.dll's cublas/nvcudart dependencies fail to load).
    setup_cuda_dll_search()

    missing_optional = []
    for module, package in optional_packages:
        try:
            importlib.import_module(module)
        # 可选包导入可能抛出 RuntimeError（如 llama_cpp 的 DLL 加载失败），
        # 这里统一按"未安装/不可用"处理为警告，不应导致启动崩溃。
        # Optional imports may raise RuntimeError (e.g. llama_cpp DLL load failure);
        # treat as "not installed/unavailable" warning, never a fatal startup crash.
        except (ImportError, RuntimeError, OSError):
            missing_optional.append(package)

    if missing_required:
        return {
            "name": "Required Packages / 必需依赖包",
            "status": SystemStatus.ERROR.value,
            "message": f"Missing {len(missing_required)} required package(s) / 缺少{len(missing_required)}个必需包",
            "detail": f"Missing / 缺少: {', '.join(missing_required)}\nOptional missing / 可选缺少: {', '.join(missing_optional)}",
            "fix": f"运行 / Run: pip install -r backend/requirements.txt",
        }
    elif missing_optional:
        return {
            "name": "Dependencies / 依赖包",
            "status": SystemStatus.WARNING.value,
            "message": f"Optional packages missing / 可选包未安装: {', '.join(missing_optional)}",
            "detail": f"All required packages OK. Optional missing: {', '.join(missing_optional)}",
            "fix": f"运行 / Run: pip install {' '.join(missing_optional)}",
        }
    else:
        return {
            "name": "Dependencies / 依赖包",
            "status": SystemStatus.OK.value,
            "message": "All packages installed / 所有依赖包已安装",
            "detail": f"Required: OK\nOptional: OK",
            "fix": "",
        }


def _check_skills_dir() -> dict[str, Any]:
    """Check skills directory exists and has valid skills / 检查Skills目录是否存在并有有效文件。"""
    # 动态访问以获取工作空间覆盖后的最新值
    # Dynamic access to get workspace-overridden value
    skills_dir = consts.SKILLS_DIR
    if not skills_dir.exists():
        return {
            "name": "Skills Directory / Skills目录",
            "status": SystemStatus.WARNING.value,
            "message": f"Skills directory not found / Skills目录未找到: {skills_dir}",
            "detail": f"Expected at / 期望路径: {skills_dir}",
            "fix": "请确保skills目录存在 / Ensure the skills directory exists",
        }

    # Count valid skill files / 统计有效Skill文件
    skill_count = 0
    for skill_dir in skills_dir.iterdir():
        if skill_dir.is_dir() and (skill_dir / "skill.md").exists():
            skill_count += 1

    if skill_count == 0:
        return {
            "name": "Skills / Skills",
            "status": SystemStatus.WARNING.value,
            "message": "No valid skills found / 未找到有效的Skill文件",
            "detail": f"Directory exists but no skill.md files found in / 目录存在但未找到skill.md: {skills_dir}",
            "fix": "请在skills/目录下添加模型Skill文件夹 / Add skill folders under skills/",
        }

    return {
        "name": "Skills / Skills",
        "status": SystemStatus.OK.value,
        "message": f"{skill_count} skill(s) found / 找到{skill_count}个Skill",
        "detail": f"Directory / 目录: {skills_dir}",
        "fix": "",
    }


def _check_models_dir() -> dict[str, Any]:
    """Check models directory status / 检查模型目录状态。"""
    # 动态访问以获取工作空间覆盖后的最新值
    # Dynamic access to get workspace-overridden value
    models_dir = consts.MODELS_DIR
    if not models_dir.exists():
        models_dir.mkdir(parents=True, exist_ok=True)

    # Look for GGUF files / 查找GGUF文件
    gguf_files = list(models_dir.rglob("*.gguf"))
    if not gguf_files:
        return {
            "name": "Local Models / 本地模型",
            "status": SystemStatus.WARNING.value,
            "message": "No GGUF model files found / 未找到GGUF模型文件",
            "detail": f"Put .gguf files in / 将.gguf文件放入: {models_dir}\n"
                      f"Or switch to online/Ollama provider / 或切换到在线/Ollama后端",
            "fix": "下载GGUF模型或使用在线API / Download GGUF models or use online API",
        }

    return {
        "name": "Local Models / 本地模型",
        "status": SystemStatus.OK.value,
        "message": f"{len(gguf_files)} GGUF file(s) found / 找到{len(gguf_files)}个GGUF文件",
        "detail": f"Directory / 目录: {models_dir}",
        "fix": "",
    }


def _check_config(config: Any) -> dict[str, Any]:
    """Check configuration validity / 检查配置有效性。"""
    active_provider = config.get("active_provider", "")
    provider_config = config.get_provider_config(active_provider)

    if active_provider == "local" and not provider_config.get("model_path"):
        return {
            "name": "Provider Config / 后端配置",
            "status": SystemStatus.WARNING.value,
            "message": "Local provider selected but no model path set / 选择了本地后端但未设置模型路径",
            "detail": "Set model_path in config or switch provider / 设置model_path或切换后端",
            "fix": "在设置中配置本地模型路径，或切换到在线API/Ollama / Configure model path or switch provider",
        }

    if active_provider == "online" and not provider_config.get("api_base"):
        return {
            "name": "Provider Config / 后端配置",
            "status": SystemStatus.WARNING.value,
            "message": "Online provider selected but no API base set / 选择了在线后端但未设置API地址",
            "detail": "Set api_base in config / 在配置中设置api_base",
            "fix": "在设置中配置API地址和密钥 / Configure API base URL and key in settings",
        }

    return {
        "name": "Provider Config / 后端配置",
        "status": SystemStatus.OK.value,
        "message": f"Active provider: {active_provider} / 当前后端: {active_provider}",
        "detail": f"Provider: {active_provider}",
        "fix": "",
    }


def _check_active_provider(model_manager) -> dict[str, Any]:
    """Check if the active provider is available / 检查当前后端是否可用。"""
    if model_manager is None or model_manager._active_provider_type is None:
        return {
            "name": "Provider Connection / 后端连接",
            "status": SystemStatus.WARNING.value,
            "message": "No active provider / 未设置活跃后端",
            "detail": "Configure a provider in settings / 在设置中配置后端",
            "fix": "在设置中选择并配置后端 / Select and configure a provider in settings",
        }

    # Skip live check during startup to avoid event loop issues
    # / 启动时跳过实时检查以避免事件循环冲突
    return {
        "name": "Provider Connection / 后端连接",
        "status": SystemStatus.OK.value,
        "message": f"Provider configured: {model_manager._active_provider_type} / 后端已配置",
        "detail": "Connection test skipped at startup. Test from UI. / 启动时跳过连接测试",
        "fix": "",
    }
