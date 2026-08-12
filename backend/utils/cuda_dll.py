"""
CUDA DLL search path setup for llama-cpp-python on Windows.
/ 为 Windows 上的 llama-cpp-python 设置 CUDA DLL 搜索路径。

The CUDA-enabled llama-cpp-python wheel loads its backend via ctypes with
``winmode=RTLD_GLOBAL``, which ignores ``os.add_dll_directory()``. The only
reliable way to expose the dependent DLLs is to prepend their directories to
the ``PATH`` environment variable BEFORE ``import llama_cpp``.
/ 启用 CUDA 的 llama-cpp-python 轮子通过 ctypes 以 ``winmode=RTLD_GLOBAL`` 加载后端，
该模式会忽略 ``os.add_dll_directory()``。唯一可靠的做法是在 ``import llama_cpp``
之前把依赖 DLL 的目录前置到 ``PATH`` 环境变量。

This is a shared utility: it must run before ANY code imports ``llama_cpp``,
including startup system checks (``utils/system_check.py``) and the local
provider (``providers/local_provider.py``).
/ 这是一个共享工具：必须在任何代码导入 ``llama_cpp`` 之前运行，
包括启动时的系统检查（``utils/system_check.py``）和本地后端
（``providers/local_provider.py``）。
"""

import logging
import os
import sys
from pathlib import Path

import app.constants as consts

logger = logging.getLogger(__name__)

# 是否已设置过 PATH（保证幂等，避免重复前置目录）
# Whether PATH has already been set up (idempotency guard to avoid duplicate prepends)
_prepared = False


def setup_cuda_dll_search() -> list[str]:
    """
    Prepare the DLL search path so llama-cpp-python can load its CUDA backend.
    / 准备 DLL 搜索路径，使 llama-cpp-python 能加载其 CUDA 后端。

    The CUDA-enabled llama-cpp-python wheel (ggml-cuda.dll) depends on
    ``cublas64_13.dll`` and ``nvcudart_hybrid64.dll`` at load time. These are
    NOT bundled with the wheel:
      - ``cublas64_13.dll`` ships in the ``nvidia-cublas`` pip package
        (``site-packages/nvidia/<cuNN>/bin/<arch>/``).
      - ``nvcudart_hybrid64.dll`` ships inside the NVIDIA display driver
        (DriverStore). On this machine we also copy it into ``llama_cpp/lib/``,
        which llama-cpp-python already prepends to ``PATH``.

    Because llama-cpp-python loads its libraries via ctypes with
    ``winmode=RTLD_GLOBAL`` (which ignores ``os.add_dll_directory``), the only
    reliable way to expose these DLLs is to prepend their directories to the
    ``PATH`` environment variable BEFORE ``import llama_cpp``.

    / 启用 CUDA 的 llama-cpp-python 轮子（ggml-cuda.dll）在加载时需要
    ``cublas64_13.dll`` 和 ``nvcudart_hybrid64.dll``，但这两个 DLL 并未被打进轮子：
      - ``cublas64_13.dll`` 由 ``nvidia-cublas`` pip 包提供
        （``site-packages/nvidia/<cuNN>/bin/<arch>/``）。
      - ``nvcudart_hybrid64.dll`` 由 NVIDIA 显示驱动提供（DriverStore），
        本机也已复制到 ``llama_cpp/lib/``（llama-cpp-python 会把它加进 PATH）。

    由于 llama-cpp-python 通过 ctypes 以 ``winmode=RTLD_GLOBAL`` 加载库
    （该模式会忽略 ``os.add_dll_directory``），唯一可靠的做法是在
    ``import llama_cpp`` 之前把上述 DLL 目录前置到 ``PATH`` 环境变量。

    Returns:
        Directories that were prepended to PATH / 已前置到 PATH 的目录列表。
        Empty list on subsequent calls (idempotent) / 后续调用返回空列表（幂等）。
    """
    global _prepared
    if _prepared:
        return []

    added: list[str] = []

    # 定位 DLL 根目录：源码模式用 venv 的 site-packages，
    # 打包模式用 sys._MEIPASS（PyInstaller 收集的嵌入资源目录）
    # / Locate the DLL root: source mode uses the venv site-packages,
    # frozen mode uses sys._MEIPASS (PyInstaller's embedded resource dir).
    if consts.IS_FROZEN:
        dll_base = Path(getattr(sys, "_MEIPASS", sys.prefix))
    else:
        dll_base = Path(sys.prefix) / "Lib" / "site-packages"

    # 查找 nvidia pip 包内的 CUDA 运行时 DLL 目录（cublas64_13.dll 等）
    # Locate the CUDA runtime DLL dir inside the nvidia packages (cublas64_13.dll etc.)
    nvidia_root = dll_base / "nvidia"
    if nvidia_root.is_dir():
        for bin_dir in sorted(nvidia_root.glob("*/bin/*")):
            if bin_dir.is_dir():
                added.append(str(bin_dir))

    # 查找 llama.cpp 动态后端 DLL 目录（ggml-cuda.dll / ggml.dll / llama.dll 等）
    # Locate the llama.cpp backend DLL dir (ggml-cuda.dll / ggml.dll / llama.dll etc.)
    llama_lib = dll_base / "llama_cpp" / "lib"
    if llama_lib.is_dir():
        added.append(str(llama_lib))

    # 查找 NVIDIA 驱动自带的 nvcudart_hybrid64.dll（DriverStore）
    # Locate the nvcudart_hybrid64.dll bundled with the NVIDIA driver (DriverStore)
    driver_store = Path(os.environ.get("WINDIR", r"C:\Windows")) / \
        "System32" / "DriverStore" / "FileRepository"
    if driver_store.is_dir():
        for dll in driver_store.glob("nv_dispi.inf_*/nvcudart_hybrid64.dll"):
            added.append(str(dll.parent))

    # 去重并保持顺序 / Deduplicate while preserving order
    unique: list[str] = []
    for d in added:
        if d not in unique:
            unique.append(d)

    if unique:
        os.environ["PATH"] = os.pathsep.join(unique) + os.pathsep + os.environ.get("PATH", "")
        logger.info(
            "CUDA DLL search dirs added to PATH / 已将 CUDA DLL 目录加入 PATH: %s",
            unique,
        )

    _prepared = True
    return unique
