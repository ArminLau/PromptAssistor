"""
Workspace manager for PromptAssistor.
/ PromptAssistor 工作空间管理器。

Manages user workspace directories, allowing skills, models, and outputs
to reside outside the project directory for privacy and portability.
/ 管理工作空间目录，使skills、models和输出文件可存放在项目外，保护隐私。
"""

import logging
from pathlib import Path
from typing import Any

import app.constants as consts

logger = logging.getLogger(__name__)


class WorkspaceManager:
    """
    Manages the user workspace directory.
    / 管理用户工作空间目录。

    A workspace is a user-designated system directory that can contain:
    / 工作空间是用户指定的系统目录，可包含：
    - skills/     — model skill files / 模型Skill文件
    - models/     — local LLM model files / 本地LLM模型文件
    - output/     — generated outputs / 生成输出文件

    When workspace is enabled, these override the project's default paths.
    / 启用工作空间后，这些将覆盖项目默认路径。

    Usage / 用法:
        manager = WorkspaceManager(config)
        manager.apply_workspace()
        print(consts.SKILLS_DIR)  # → workspace/skills (if enabled)
    """

    def __init__(self, config: Any) -> None:
        self._config = config

    def apply_workspace(self) -> dict[str, Any]:
        """
        Apply workspace settings from config to module-level constants.
        / 从配置中应用工作空间设置到模块级常量。

        Returns / 返回:
            Dict with workspace status info / 包含工作空间状态信息的字典。
        """
        workspace_config = self._config.get("workspace", {})
        enabled = workspace_config.get("enabled", False)

        if not enabled:
            logger.info("Workspace not enabled, using project defaults / 工作空间未启用")
            return {"enabled": False, "message": "Using project defaults"}

        ws_path_str = workspace_config.get("path", "")
        if not ws_path_str:
            logger.warning("Workspace enabled but no path set / 工作空间已启用但未设置路径")
            return {"enabled": False, "message": "Workspace path is empty"}

        ws_path = Path(ws_path_str).expanduser().resolve()

        # Validate and create workspace path / 验证并创建工作空间路径
        if not ws_path.exists():
            try:
                ws_path.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created workspace: {ws_path}")
            except OSError as e:
                logger.error(f"Cannot create workspace: {e}")
                return {"enabled": False, "message": f"Cannot create workspace: {e}"}

        # Resolve skills directory / 解析Skills目录
        skills_override = workspace_config.get("skills_dir", "")
        if skills_override:
            consts.SKILLS_DIR = Path(skills_override).expanduser().resolve()
        else:
            consts.SKILLS_DIR = ws_path / "skills"

        # Resolve models directory / 解析Models目录
        models_override = workspace_config.get("models_dir", "")
        if models_override:
            consts.MODELS_DIR = Path(models_override).expanduser().resolve()
        else:
            consts.MODELS_DIR = ws_path / "models"

        # Resolve output directory / 解析Output目录
        output_override = workspace_config.get("output_dir", "")
        if output_override:
            consts.OUTPUT_DIR = Path(output_override).expanduser().resolve()
        else:
            consts.OUTPUT_DIR = ws_path / "output"

        # Ensure all directories exist / 确保所有目录存在
        for d, name in [
            (consts.SKILLS_DIR, "skills"),
            (consts.MODELS_DIR, "models"),
            (consts.OUTPUT_DIR, "output"),
        ]:
            d.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"Workspace applied: {ws_path}\n"
            f"  skills → {consts.SKILLS_DIR}\n"
            f"  models → {consts.MODELS_DIR}\n"
            f"  output → {consts.OUTPUT_DIR}"
        )

        return {
            "enabled": True,
            "path": str(ws_path),
            "skills_dir": str(consts.SKILLS_DIR),
            "models_dir": str(consts.MODELS_DIR),
            "output_dir": str(consts.OUTPUT_DIR),
        }

    def get_workspace_info(self) -> dict[str, Any]:
        """Get current workspace info for API / 获取当前工作空间信息。"""
        ws_config = self._config.get("workspace", {})
        return {
            "enabled": ws_config.get("enabled", False),
            "path": ws_config.get("path", ""),
            "effective_skills_dir": str(consts.SKILLS_DIR),
            "effective_models_dir": str(consts.MODELS_DIR),
            "effective_output_dir": str(consts.OUTPUT_DIR),
        }
