# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for PromptAssistor — SELF-CONTAINED executable.
/ PromptAssistor PyInstaller打包配置 — 自包含可执行文件。

Packaging principle / 打包原则:
    The exe is FULLY self-contained: Python runtime + all pip dependencies +
    backend code + frontend static files + skill files.
    Users double-click to launch — NO Python installation required.
    / exe完全自包含：Python运行时 + 所有pip依赖 + 后端代码 + 前端静态文件 + Skill文件。
    用户双击即启动 — 无需安装Python。

    Only the "models/" directory is external (GGUF files are too large to embed).
    / 仅 models/ 目录为外部（GGUF文件太大不嵌入）。

Architecture / 架构:
    Entry point: backend/run.py → imports and runs uvicorn IN-PROCESS.
    All backend modules (.py) are auto-collected by PyInstaller's import analysis.
    Non-Python assets (skills/*.md, frontend dist) are embedded as datas.
    Runtime data (config.json, *.db) created in data/ next to the exe.
"""

import sys
from pathlib import Path

block_cipher = None

# ─── Collect ALL backend Python modules ──────────────────────────────────
# PyInstaller auto-follows imports from run.py → app.main → all backend code.
# We add hiddenimports for packages that use string-based imports or __init__ re-exports.
# / PyInstaller自动跟踪run.py → app.main → 所有后端代码的导入链。
# 对于使用字符串导入或__init__重导出的包，手动添加hiddenimports。

# Analyze the entry point / 分析入口点
a = Analysis(
    ['backend/run.py'],
    pathex=['backend'],             # Put backend/ on the module search path
    binaries=[],
    datas=[
        # Frontend static files (compiled React app) / 前端静态文件
        ('frontend/dist', 'static'),
        # Skill files / Skill文件
        ('skills', 'skills'),
        # Models README placeholder / 模型目录说明
        ('models/README.md', 'models'),
    ],
    hiddenimports=[
        # ─── Web Framework ───────────────────────────────────────
        'fastapi',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'fastapi.staticfiles',
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'starlette',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.staticfiles',
        'python_multipart',

        # ─── Database ────────────────────────────────────────────
        'sqlalchemy',
        'sqlalchemy.ext',
        'sqlalchemy.ext.asyncio',
        'sqlalchemy.orm',
        # 'alembic' — not installed yet, optional DB migration tool

        # ─── Data Validation ─────────────────────────────────────
        'pydantic',
        'pydantic.fields',
        'pydantic.main',

        # ─── YAML (skill parsing) ────────────────────────────────
        'yaml',

        # ─── HTTP / API Clients ──────────────────────────────────
        'httpx',
        'openai',
        'ollama',

        # ─── LLM Backend (lazy-loaded by LocalProvider) ────────
        # 'llama_cpp' NOT included as hiddenimport — native DLLs
        # need special PyInstaller hook for bundling.
        # LocalProvider handles ImportError gracefully.

        # ─── Media Processing (auto-collected when installed) ────
        # PIL/Pillow — image processing
        # cv2/opencv — video frame extraction
        # moviepy — video processing
        # pydub — audio processing

        # ─── Misc ────────────────────────────────────────────────
        'anyio',
        'sniffio',
        'h11',
        'websockets',

        # ─── Backend internal packages (ensure collection) ──────
        'app',
        'app.main',
        'app.config',
        'app.constants',
        'api',
        'api.router',
        'api.model_api',
        'api.config_api',
        'api.reverse_api',
        'api.expand_api',
        'api.batch_api',
        'api.library_api',
        'api.skill_api',
        'api.system_api',
        'core',
        'core.engine',
        'core.skill_manager',
        'core.model_manager',
        'core.workspace_manager',
        'providers',
        'providers.base',
        'providers.local_provider',
        'providers.online_provider',
        'providers.ollama_provider',
        'features',
        'features.prompt_reverse',
        'features.prompt_expand',
        'features.batch_tagging',
        'features.prompt_library',
        'features.skill_editor',
        'db',
        'db.database',
        'db.models',
        'utils',
        'utils.file_handler',
        'utils.media_processor',
        'utils.logger',
        'utils.validators',
        'utils.system_check',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'turtle',
        'lib2to3',
        'test',
        'llama_cpp',        # Native DLLs break in PyInstaller, lazy-loaded by LocalProvider
        'llama_cpp_python',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PromptAssistor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # Show console for logs / 显示控制台查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,             # Add .ico path later / 后续添加图标
)
