"""
PromptAssistor dev-mode launcher — 仅用于源码开发模式。
/ Dev-mode launcher — ONLY for source development.

For packaged exe, use backend/run.py (PyInstaller entry point).
/ 打包的exe使用 backend/run.py 作为入口点。

Usage / 用法:
    python launcher.py
    python launcher.py --port 18720 --no-browser
"""

import argparse
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

LAUNCHER_DIR = Path(__file__).resolve().parent
BACKEND_DIR = LAUNCHER_DIR / "backend"
DEFAULT_PORT = 18720


def main():
    parser = argparse.ArgumentParser(description="PromptAssistor (Dev Mode)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Server port")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser")
    args = parser.parse_args()

    port = args.port
    url = f"http://127.0.0.1:{port}"

    if not BACKEND_DIR.exists():
        print(f"[ERROR] Backend directory not found: {BACKEND_DIR}")
        print(f"请确保 'backend/' 文件夹与 launcher.py 在同一目录。")
        sys.exit(1)

    python_exe = sys.executable

    env = os.environ.copy()
    python_path = str(BACKEND_DIR)
    if "PYTHONPATH" in env:
        python_path = str(BACKEND_DIR) + os.pathsep + env["PYTHONPATH"]
    env["PYTHONPATH"] = python_path
    env["PROMPTASSISTOR_HOME"] = str(LAUNCHER_DIR)

    print("=" * 55)
    print("PromptAssistor v0.1.0 [Dev Mode / 开发模式]")
    print("=" * 55)
    print(f"Python:        {python_exe}")
    print(f"Backend dir:   {BACKEND_DIR}")
    print(f"Starting:      {url}")
    print(f"API docs:      {url}/docs")
    print(f"Press Ctrl+C to stop / 按 Ctrl+C 停止")
    print("=" * 55)

    try:
        process = subprocess.Popen(
            [
                python_exe, "-m", "uvicorn",
                "app.main:app",
                "--host", "127.0.0.1",
                "--port", str(port),
                "--log-level", "info",
            ],
            cwd=str(BACKEND_DIR),
            env=env,
        )

        time.sleep(2)

        if process.poll() is not None:
            print(f"\n[ERROR] Server exited immediately (code {process.returncode}).")
            print(f"\n可能原因:")
            print(f"  1. 依赖未安装 → pip install -r backend/requirements.txt")
            print(f"  2. 端口 {port} 被占用 → 尝试: python launcher.py --port 18721")
            sys.exit(1)

        if not args.no_browser:
            webbrowser.open(url)

        print(f"Server running. / 服务运行中。")
        process.wait()

    except KeyboardInterrupt:
        print("\nShutting down... / 关闭中...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        print("Goodbye! / 再见!")
    except Exception as e:
        print(f"\nError: {e}")
        print(f"请确保已安装依赖: pip install -r backend/requirements.txt")
        sys.exit(1)


if __name__ == "__main__":
    main()
