"""
Self-contained entry point for PyInstaller-packaged PromptAssistor exe.
/ PyInstaller打包的自包含入口点。

Runs uvicorn IN-PROCESS (no subprocess, no system Python needed).
The exe contains: Python runtime + all pip deps + backend code + frontend + skills.
/ 在进程内运行uvicorn（无需子进程，无需系统Python）。
exe包含：Python运行时 + 所有pip依赖 + 后端代码 + 前端 + skills。

Usage / 用法:
    PromptAssistor.exe                  # 默认端口18720 / default port
    PromptAssistor.exe --port 18721     # 自定义端口 / custom port
    PromptAssistor.exe --no-browser     # 不打开浏览器 / don't open browser
"""

import argparse
import os
import sys
import webbrowser
from pathlib import Path

# Detect PyInstaller frozen mode / 检测PyInstaller打包模式
IS_FROZEN = getattr(sys, 'frozen', False)

# ─── Path resolution / 路径解析 ──────────────────────────────────────────
if IS_FROZEN:
    # exe所在目录 — 用于运行时数据（config, db, models）
    # exe directory — for runtime data (config, db, models)
    EXE_DIR = Path(sys.executable).resolve().parent

    # sys._MEIPASS — PyInstaller解压datas的临时目录
    # sys._MEIPASS — temp directory where PyInstaller extracts datas
    MEIPASS = Path(sys._MEIPASS)

    # 嵌入的资源路径 / Embedded resource paths
    STATIC_DIR = MEIPASS / "static"      # 前端文件 / frontend files
    SKILLS_DIR = MEIPASS / "skills"      # Skill文件 / skill files

    # 运行时数据目录（exe旁边，可读写） / Runtime data dir (next to exe, writable)
    DATA_DIR = EXE_DIR / "data"
    MODELS_DIR = EXE_DIR / "models"

    # 确保运行时目录存在 / Ensure runtime directories exist
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    os.environ["PROMPTASSISTOR_HOME"] = str(EXE_DIR)
    os.environ["PROMPTASSISTOR_SKILLS_DIR"] = str(SKILLS_DIR)
    os.environ["PROMPTASSISTOR_STATIC_DIR"] = str(STATIC_DIR)
    os.environ["PROMPTASSISTOR_DATA_DIR"] = str(DATA_DIR)
    os.environ["PROMPTASSISTOR_MODELS_DIR"] = str(MODELS_DIR)
else:
    # 源码运行模式 / Source run mode
    EXE_DIR = Path(__file__).resolve().parent.parent  # project root
    STATIC_DIR = Path(__file__).resolve().parent / "static"
    # These will be set by constants.py, but set env for consistency
    os.environ["PROMPTASSISTOR_HOME"] = str(EXE_DIR)

DEFAULT_PORT = 18720


def main():
    parser = argparse.ArgumentParser(description="PromptAssistor")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Server port / 服务器端口")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser / 不打开浏览器")
    args = parser.parse_args()

    port = args.port
    url = f"http://127.0.0.1:{port}"

    print("=" * 55)
    print("PromptAssistor v0.1.0")
    if IS_FROZEN:
        print("[Self-contained mode / 自包含模式]")
    else:
        print("[Source mode / 源码模式]")
    print("=" * 55)
    print(f"App home:    {EXE_DIR}")
    print(f"Static dir:  {STATIC_DIR}")
    print(f"Skills dir:  {SKILLS_DIR if IS_FROZEN else 'backend/../skills'}")
    print(f"Data dir:    {DATA_DIR if IS_FROZEN else 'backend/data'}")
    print(f"Models dir:  {MODELS_DIR if IS_FROZEN else 'models'}")
    print(f"Server:      {url}")
    print(f"API docs:    {url}/docs")
    print(f"Press Ctrl+C to stop / 按 Ctrl+C 停止")
    print("=" * 55)

    # Ensure backend/ is in sys.path for imports / 确保backend/在导入路径中
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    if not args.no_browser:
        # Delay browser open slightly / 稍微延迟打开浏览器
        import threading
        def _open_browser():
            import time
            time.sleep(2)
            webbrowser.open(url)
        threading.Thread(target=_open_browser, daemon=True).start()

    # Run uvicorn IN-PROCESS / 在进程内运行uvicorn
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
