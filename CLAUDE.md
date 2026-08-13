# PromptAssistor - 项目文档

## 项目概述

PromptAssistor 是一个跨平台桌面应用，用于为各类生图/生视频AI模型生成专业提示词(Prompt)。
支持多模态输入(图片、音频、视频、文本)，可切换多种LLM后端(本地模型、在线API、Ollama)。

- **目标用户:** AI图像/视频创作者
- **平台:** Windows 10/11, macOS 12+
- **许可证:** MIT

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面壳 | Electron 33+ | 跨平台桌面应用框架 |
| 前端UI | React 19 + TypeScript 5 | 现代化组件式UI |
| UI组件库 | Ant Design 5 | 生产级React组件库 |
| 状态管理 | Zustand | 轻量级状态管理 |
| HTTP客户端 | axios | 前后端通信 |
| 后端框架 | Python 3.11+ / FastAPI | 高性能异步API |
| ASGI服务器 | uvicorn | 生产级ASGI服务器 |
| 本地LLM | llama-cpp-python | GGUF模型加载，支持多模态 |
| 在线API | httpx + openai SDK | 多厂商API兼容 |
| Ollama | ollama Python客户端 | 本地Ollama连接 |
| 数据库 | SQLite + SQLAlchemy | 本地数据存储 |
| 图片处理 | Pillow + opencv-python | 图片分析与预处理 |
| 音频处理 | pydub + ffmpeg-python | 音频处理 |
| 视频处理 | moviepy | 视频帧提取 |
| 前端包管理 | pnpm (项目本地) | 高效的Node包管理 |
| 后端包管理 | pip + venv (项目本地) | Python标准包管理 |
| 打包 | electron-builder | Windows/macOS安装包 |

---

## 项目目录结构

```
PromptAssistor/
├── backend/                    # Python FastAPI后端
│   ├── app/                    # 应用入口和配置
│   │   ├── main.py             # FastAPI应用、启动、CORS
│   │   ├── config.py           # 配置管理
│   │   └── constants.py        # 应用常量
│   ├── core/                   # 核心业务逻辑
│   │   ├── engine.py           # 提示词生成编排
│   │   ├── skill_manager.py    # Skill加载/解析/验证
│   │   └── model_manager.py    # LLM后端生命周期管理
│   ├── providers/              # LLM提供者实现(策略模式)
│   │   ├── base.py             # 抽象基类(接口)
│   │   ├── local_provider.py   # 本地GGUF (llama-cpp-python)
│   │   ├── online_provider.py  # 在线API (Deepseek/Kimi/GLM/GPT等)
│   │   └── ollama_provider.py  # 本地Ollama连接
│   ├── features/               # 五大功能模块(相互独立)
│   │   ├── prompt_reverse.py   # F1: 提示词反推
│   │   ├── prompt_expand.py    # F2: 提示词扩写
│   │   ├── batch_tagging.py    # F3: 数据集批量打标
│   │   ├── prompt_library.py   # F4: 提示词维护
│   │   └── skill_editor.py     # F5: Skill维护
│   ├── api/                    # REST API路由
│   │   ├── router.py           # 主路由
│   │   ├── reverse_api.py      # F1 端点
│   │   ├── expand_api.py       # F2 端点
│   │   ├── batch_api.py        # F3 端点
│   │   ├── library_api.py      # F4 端点
│   │   ├── skill_api.py        # F5 端点
│   │   ├── model_api.py        # 模型管理端点
│   │   └── config_api.py       # 配置端点
│   ├── db/                     # 数据库层
│   │   ├── database.py         # SQLAlchemy设置、会话管理
│   │   ├── models.py           # ORM模型
│   │   └── migrations/         # 数据库迁移(Alembic)
│   ├── utils/                  # 共享工具
│   │   ├── file_handler.py     # 文件I/O、格式检测
│   │   ├── media_processor.py  # 图片/音频/视频预处理
│   │   ├── logger.py           # 日志配置
│   │   └── validators.py       # 输入验证
│   ├── locales/                # 国际化翻译文件 / i18n locale files
│   │   ├── zh_CN.json          # 中文翻译
│   │   └── en_US.json          # English translations
│   ├── data/                   # 运行时数据(gitignored)
│   ├── requirements.txt        # Python依赖
│   └── pyproject.toml          # 项目元数据
│
├── frontend/                   # Electron + React前端
│   ├── electron/               # Electron主进程
│   │   ├── main.ts             # Electron入口、窗口管理
│   │   ├── preload.ts          # 上下文桥接(安全IPC)
│   │   └── backend.ts          # 后端进程管理器
│   ├── src/                    # React渲染进程
│   │   ├── App.tsx             # 根组件
│   │   ├── main.tsx            # React入口
│   │   ├── pages/              # 每功能一个页面
│   │   ├── components/         # 可复用UI组件
│   │   ├── hooks/              # 自定义React Hooks
│   │   ├── stores/             # Zustand状态存储
│   │   ├── services/           # API服务层
│   │   ├── types/              # TypeScript类型定义
│   │   ├── locales/            # 国际化翻译文件 / i18n locale files
│   │   │   ├── zh-CN.json      # 中文翻译
│   │   │   └── en-US.json      # English translations
│   │   └── assets/             # 静态资源
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── electron-builder.yml
│   └── .npmrc
│
├── models/                     # 本地LLM模型(用户管理, gitignored)
│   └── README.md
│
├── skills/                     # 模型Skill文件(可扩展)
│   ├── minimax_h3/
│   │   └── skill.md
│   └── README.md
│
├── scripts/                    # 开发和构建脚本
├── tests/                      # 后端测试
├── CLAUDE.md                   # 本文件 - AI助手项目文档
├── .gitignore
├── LICENSE
└── README.md
```

---

## 开发规范

### Python (后端)
- 遵循 PEP 8，最大行长 100 字符
- 所有函数签名必须有类型注解 (Type Hints)
- 使用 Google 风格 docstring
- 默认使用 async/await (FastAPI 是异步的)
- 文件编码: UTF-8
- 使用 `pathlib.Path` 处理所有文件路径(跨平台兼容)
-
### 代码注释规范 — 中英双语 (MANDATORY)
- **所有代码注释必须同时包含中文和英文**，格式: `中文描述 / English description`
- Docstring 使用中文描述，关键术语附英文原词
- 这确保:
  1. 国内开发者能快速理解代码逻辑
  2. 国际贡献者能参与项目
  3. 与 AI 编程助手协作时，双语注释让模型理解更准确
- 示例:
  ```python
  # 加载模型Skill文件 / Load model skill file
  def load_skill(skill_name: str) -> Skill:
      """加载指定名称的Skill / Load skill by name.
      
      Args:
          skill_name: Skill标识名 / Skill identifier name.
      Returns:
          Skill对象 / Skill object.
      """
  ```

### TypeScript (前端)
- tsconfig.json 启用 strict 模式
- 优先使用 `interface` 而非 `type`
- 函数式组件 + Hooks（不使用 class 组件）
- 一个文件一个组件，文件名与组件名一致
- 使用 `async/await` 并做好错误处理
-
### 国际化 (i18n) 规范 — 中英文一键切换
- APP 必须支持中文/英文一键切换，切换后所有UI文本立即生效
- 实现方案:
  - 后端: 使用 `gettext` 或自定义 i18n 模块管理翻译字符串
  - 前端: 使用 `react-i18next` 或 Ant Design 内置的 `ConfigProvider` 国际化
  - 所有用户可见文本 (UI标签、提示、错误消息) 必须抽取为翻译 key，不得硬编码
- 翻译文件存放:
  - 后端: `backend/locales/zh_CN.json`, `backend/locales/en_US.json`
  - 前端: `frontend/src/locales/zh-CN.json`, `frontend/src/locales/en-US.json`
- 语言偏好保存到 `config.json` 的 `ui.language` 字段，启动时读取
- 开发期间: 每新增一个UI文本，必须同时在中文和英文翻译文件中添加对应条目
-
### 打包与分发规范

#### 核心原则 (CRITICAL) / Core Principle

**打包成的 exe 必须是完全自包含的（Self-Contained）。用户双击即启动，无需安装任何运行时依赖。**

> ❌ 错误做法：exe 只是薄启动器，依赖系统 Python + pip install
> ✅ 正确做法：exe 内嵌 Python 运行时 + 所有 pip 依赖 + 后端代码 + 前端 + Skills

#### 架构概述 / Architecture Overview

```
PromptAssistor.exe  (单个文件, ~25MB)
├── Python 3.12 运行时 (embedded)
├── 所有 pip 依赖 (fastapi, uvicorn, sqlalchemy, pydantic, yaml, httpx, PIL, ...)
├── 后端 Python 代码 (backend/ 全部模块)
├── 前端静态文件 (frontend/dist/ → 嵌入为 static/)
├── Skill 文件 (skills/ → 嵌入为 skills/)
└── models/README.md (嵌入，models/ 目录在 exe 旁边创建供用户放置 GGUF)

运行时数据目录 (exe 旁边自动创建):
  data/       — config.json, prompts.db, app.log
  models/     — 用户放置 GGUF 模型文件
  output/     — 生成输出
```

**入口点:** `backend/run.py` — 在进程内直接调用 `uvicorn.run()`，无需 subprocess。

#### 用户系统要求 / User System Requirements

| 要求 | 说明 |
|------|------|
| Windows 10/11 或 macOS 12+ | 操作系统 |
| **无需安装 Python** | Python 运行时已嵌入 exe |
| **无需 pip install** | 所有依赖已嵌入 exe |
| **无需安装任何东西** | 双击即用 |

#### 完整打包流程 / Complete Packaging Procedure

**每次打包必须按以下步骤执行，不可跳过任何一步：**

```bash
# ─── Step 1: 编译前端 (MUST DO FIRST) ───────────────────────
cd frontend
npx vite build
# 确认: dist/ 目录已生成

# ─── Step 2: 清理旧的构建缓存 ───────────────────────────────
cd ..
rm -rf build-temp/ dist-exe/

# ─── Step 3: 执行 PyInstaller 打包 ──────────────────────────
# 确保 venv 中已安装所有依赖: pip install -r backend/requirements.txt
# ⚠️ GPU 版本需先完成「GPU/CUDA DLL 收集」小节的三个准备步骤：
#    - nvidia-cublas + nvidia-cuda-runtime 已装进 venv
#    - nvcudart_hybrid64.dll 已复制进 llama_cpp/lib/
#    - prompt_assistor.spec 已配置收集 nvidia/cu13/bin/x86_64/*.dll 与 llama_cpp/lib/*.dll
.venv/Scripts/python.exe -m PyInstaller prompt_assistor.spec --distpath dist-exe --workpath build-temp --clean
# 确认: dist-exe/PromptAssistor.exe 已生成
#   - 标准版（在线+Ollama）: 约 25MB
#   - GPU 完整版（含本地模型）: 约 500MB（含 nvidia-cublas ~383MB）

# ─── Step 4: 复制 models README 到发布目录 ──────────────────
mkdir -p dist-exe/models && cp models/README.md dist-exe/models/

# ─── Step 5: 验证打包结果 (MUST DO) ─────────────────────────
cd dist-exe
./PromptAssistor.exe --no-browser &
sleep 3
curl http://127.0.0.1:18720/health                    # 应返回 200 {"status":"ok"}
curl http://127.0.0.1:18720/api/v1/system/models/scan  # 应返回 200 (非404!)
curl -o /dev/null -w "%{http_code}" http://127.0.0.1:18720/  # 应返回 200 (前端正常)
# 注意: 验证完后 taskkill //F //IM PromptAssistor.exe
```

#### 打包验证检查清单 / Packaging Verification Checklist

- [ ] **Step 1:** `frontend/dist/` 存在且包含最新构建产物
- [ ] **Step 3:** PyInstaller 输出 `Build complete!`
- [ ] **Step 5a:** `GET /health` → 200，`active_provider` 不是 `"workspace"`
- [ ] **Step 5b:** `GET /api/v1/system/models/scan` → 200（非 404）
- [ ] **Step 5c:** `GET /` → 200（前端页面正常 serve）
- [ ] **Step 5d:** 关闭 exe 后，双击 exe 能从资源管理器正常启动
- [ ] **Step 5e（仅 GPU 版）:** 配置本地模型路径 → `PUT /api/v1/models/active?provider_type=local`
      切换成功（返回 200），且 `nvidia-smi` 显示模型已占用显存（如 ~6.5GB），
      F2 扩写生成用时秒级（而非 CPU 回退的分钟级）

#### prompt_assistor.spec 关键配置

```python
# 入口点 / Entry point
a = Analysis(['backend/run.py'], pathex=['backend'], ...)

# 嵌入的非 Python 资源 / Embedded non-Python assets
datas=[
    ('frontend/dist', 'static'),   # 前端构建产物
    ('skills', 'skills'),          # Skill 文件
    ('models/README.md', 'models'), # 模型目录占位
    # ─── GPU 版追加 / GPU version additions ───
    ('.venv/Lib/site-packages/nvidia/cu13/bin/x86_64', 'nvidia/cu13/bin/x86_64'),
    ('.venv/Lib/site-packages/llama_cpp/lib', 'llama_cpp/lib'),
]

# 隐藏导入 / Hidden imports (确保所有模块被收集)
hiddenimports=['fastapi', 'uvicorn', 'sqlalchemy', 'pydantic', 'yaml', 'httpx',
               'PIL', 'PIL.Image', 'starlette', 'python_multipart',
               'llama_cpp', 'llama_cpp.llama', 'llama_cpp.llama_cpp', ...]

# 排除项 / Excludes (GPU 版已移除 llama_cpp，勿再加回)
excludes=['tkinter', 'turtle', 'lib2to3', 'test']
```

#### GPU/CUDA DLL 收集 (Blackwell sm_120) / CUDA DLL Collection

> ✅ **Session 11 已完整验证通过** — 本小节描述的是「打包 GPU 版 exe」的完整流程，
> 已在 RTX 5060 Ti 上验证：exe 内本地模型可正常走 GPU（显存 6.5GB，生成 ~4.7s）。

**打包 GPU 版 exe 前必须额外收集以下 CUDA 运行时 DLL，否则本地模型无法走 GPU（Session 10 修复项）：**

| DLL | 来源 (venv) | 打包目标目录 |
|-----|-------------|--------------|
| `cublas64_13.dll` / `cublasLt64_13.dll` / `cudart64_13.dll` / `nvblas64_13.dll` | `.venv/Lib/site-packages/nvidia/cu13/bin/x86_64/` | `nvidia/cu13/bin/x86_64/` |
| `ggml-cuda.dll` / `ggml-cpu.dll` / `ggml.dll` / `llama.dll` / `mtmd.dll` 等 | `.venv/Lib/site-packages/llama_cpp/lib/` | `llama_cpp/lib/` |
| `nvcudart_hybrid64.dll` | NVIDIA 驱动 DriverStore → **复制到** `llama_cpp/lib/` | `llama_cpp/lib/` |

**GPU 打包三步准备（venv 内） / Three preparation steps for GPU packaging:**

```bash
# ─── 准备 1: 确认 llama-cpp-python 是 sm_120 CUDA 13.0 轮子 ──────────
# Confirm llama-cpp-python is the sm_120 CUDA 13.0 wheel (Session 10)
.venv/Scripts/python.exe -c "import importlib.metadata as m; print(m.version('llama-cpp-python'))"
# 期望 / Expect: 0.3.20 (dougeeai 的 +cuda13.0.sm100.sm120 构建)
# 若为官方 cu12 轮子，Blackwell sm_120 会回退 CPU

# ─── 准备 2: 确认 nvidia CUDA 运行时 DLL 已装进 venv ────────────────
# Confirm nvidia CUDA runtime DLLs are installed in venv (pip packages)
ls .venv/Lib/site-packages/nvidia/cu13/bin/x86_64/   # 应含 cublas64_13.dll 等
# 缺失时安装 / Install if missing:
#   .venv/Scripts/python.exe -m pip install nvidia-cuda-runtime==13.0.96 nvidia-cublas==13.0.2.14

# ─── 准备 3: 把 nvcudart_hybrid64.dll 复制进 llama_cpp/lib ───────────
# Copy nvcudart_hybrid64.dll into llama_cpp/lib (from NVIDIA driver DriverStore)
# 先定位 DriverStore 中的文件 / Locate the file in DriverStore first:
#   find "C:/Windows/System32/DriverStore/FileRepository" -name "nvcudart_hybrid64.dll"
cp "C:/Windows/System32/DriverStore/FileRepository/nv_dispi.inf_*/nvcudart_hybrid64.dll" \
   ".venv/Lib/site-packages/llama_cpp/lib/nvcudart_hybrid64.dll"
# 说明: cuda_dll.py 运行时也会在 DriverStore 查找，但打包进 exe 更彻底、更自包含
# Note: cuda_dll.py also searches DriverStore at runtime, but bundling is more self-contained
```

**`prompt_assistor.spec` 需做的三处改动 / Three spec changes:**

```python
# ─── 改动 1: datas 收集 CUDA DLL 目录 ────────────────────────────────
# Append to the `datas=[...]` list:
datas += [
    # nvidia CUDA 运行时 (cublas64_13.dll / cudart64_13.dll / nvblas64_13.dll ...)
    ('.venv/Lib/site-packages/nvidia/cu13/bin/x86_64', 'nvidia/cu13/bin/x86_64'),
    # llama.cpp 动态后端 DLL (ggml-cuda.dll / ggml-cpu.dll / ggml.dll / llama.dll
    # + 上一步复制的 nvcudart_hybrid64.dll)
    ('.venv/Lib/site-packages/llama_cpp/lib', 'llama_cpp/lib'),
]

# ─── 改动 2: hiddenimports 加入 llama_cpp ────────────────────────────
# Add to hiddenimports (replaces the old "NOT included" comment block):
#   'llama_cpp', 'llama_cpp.llama', 'llama_cpp.llama_cpp',
#   'llama_cpp._internals', 'llama_cpp._ggml', 'llama_cpp.llama_chat_format',

# ─── 改动 3: 从 excludes 移除 llama_cpp ──────────────────────────────
# Remove 'llama_cpp' and 'llama_cpp_python' from excludes=[...]
```

**打包结果预期 / Expected result:**

| 指标 | GPU 完整版 | 标准版（在线+Ollama） |
|------|-----------|---------------------|
| exe 大小 | **~500MB**（含 nvidia-cublas ~383MB） | ~25MB |
| 本地 GGUF 模型 | ✅ 支持 GPU 加速 | ❌ 回退报错 |
| 在线 API / Ollama | ✅ | ✅ |

> **⚠️ 关键约束:** llama-cpp-python 通过 `ctypes.CDLL(winmode=RTLD_GLOBAL)` 加载，
> 忽略 `os.add_dll_directory()`，只认标准搜索路径（含 `PATH`）。[cuda_dll.py](backend/utils/cuda_dll.py)
> 的 `setup_cuda_dll_search()` 已根据 `IS_FROZEN` 自动切换：打包模式指向 `sys._MEIPASS`
> 内收集的 DLL 目录，源码模式指向 `sys.prefix` 下的 `site-packages`。
>
> llama-cpp-python 的 `_base_path` = `os.path.dirname(__file__)/lib`，冻结模式下即
> `sys._MEIPASS/llama_cpp/lib`，并在加载时把该目录前置到 `PATH` —— 因此把 DLL 收集到
> `llama_cpp/lib/` 目标目录即可被正确加载。

> 说明: 若不打包 GPU 版（仅在线 API / Ollama），可跳过本节；但 exe 内切换本地模型会失败并自动回退。

#### 路径处理 / Path Resolution

```python
# constants.py 根据 IS_FROZEN 自动切换:
if IS_FROZEN:
    PROJECT_ROOT = exe所在目录         # 运行时数据
    BACKEND_ROOT = sys._MEIPASS       # 嵌入资源 (static/, skills/)
    DATA_DIR = exe旁边/data/           # config, db (可读写)
    MODELS_DIR = exe旁边/models/       # 用户放置GGUF (可读写)
else:
    PROJECT_ROOT = 项目根目录           # 源码模式
    BACKEND_ROOT = backend/目录
```

#### 重要注意事项 / Important Notes

1. **exe 是自包含的 — 用户不需要安装任何东西** — 这是打包的根本目的
2. **永远不要跳过 Step 5 验证** — 确保 scan 端点返回 200（不是 404）
3. **打包前确认前端已重新构建** — 否则 exe 内嵌的是过期页面
4. **venv 中必须安装 requirements.txt 所有依赖** — 缺依赖会导致运行时 ImportError
5. **dist-exe/ 目录不提交 Git** — 已在 `.gitignore` 中
6. **`launcher.py` 仅用于源码开发模式** — exe 不经过 launcher.py
7. **GPU 版打包需收集 CUDA DLL** — 见上方「GPU/CUDA DLL 收集」小节：
   打包本地模型 GPU 加速必须收集 `nvidia/cu13/bin/x86_64/*.dll` 与 `nvcudart_hybrid64.dll`，
   否则 exe 内本地模型会回退 CPU 或报错（Session 10）

### 模块独立原则 (极其重要)
- **功能模块禁止互相导入** — 每个 feature 是封闭模块
- **Provider 相互隔离** — 每个 provider 文件自包含，不交叉导入
- **共享代码放到 `utils/` 或 `core/`** — 绝对不放到 feature 模块
- **API 路由保持轻薄** — 只做参数校验和委派，业务逻辑在 feature 模块
- 如果你发现需要从另一个 feature 导入 → 重构到 `core/` 或 `utils/`

### 命名规范
| 元素 | Python | TypeScript |
|------|--------|------------|
| 文件 | `snake_case.py` | `PascalCase.tsx` |
| 类/组件 | `PascalCase` | `PascalCase` |
| 函数 | `snake_case()` | `camelCase()` |
| 常量 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| 私有成员 | `_prefix` | 极少使用 |

### Git 规范
- 分支格式: `feature/<name>` 或 `fix/<name>`
- Commit 消息: 中文
- 绝对不要提交: `.venv/`, `node_modules/`, `data/`, `models/`, `__pycache__/`, `dist/`, `.pnpm-store/`, `frontend/release/`
-
### Git 安全规范 (CRITICAL — 必须遵守)
- **绝对禁止**将以下内容提交到 Git 仓库:
  - API 密钥 (api_key, token, secret, password)
  - `.env` 文件 (包含敏感环境变量)
  - `backend/data/config.json` (包含用户运行时的API密钥)
  - 任何包含第三方服务凭据的文件
  - SSH 私钥、证书文件 (.pem, .key, .p12, .pfx)
- 敏感配置模板: 如需要提供配置模板，使用 `.env.example` (仅包含空值占位符)
- 提交前检查: 每次 `git add` 前确认不包含敏感信息
- `backend/data/config.json` 已加入 `.gitignore`，不会被追踪
- 如果误提交了敏感信息:
  1. 立即轮换(revoke)泄露的密钥
  2. 使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清除历史
  3. 强制推送后通知所有协作者

---

## 核心架构

### Provider 模式 (LLM 后端)

所有 LLM 提供者实现统一接口 `BaseProvider`:

```python
class BaseProvider(ABC):
    @abstractmethod
    async def initialize(self, config: dict) -> bool: ...
    @abstractmethod
    async def generate(self, system_prompt, user_prompt, images=None, audio=None, video=None, **kwargs) -> str: ...
    @abstractmethod
    async def is_available(self) -> bool: ...
    @property
    @abstractmethod
    def provider_type(self) -> ProviderType: ...
    @abstractmethod
    async def shutdown(self) -> None: ...
```

三种实现:
- `LocalProvider` — llama-cpp-python, 加载 GGUF + mmproj 多模态
- `OnlineProvider` — httpx/OpenAI SDK, 支持多厂商API
- `OllamaProvider` — ollama Python 客户端, 本地Ollama服务

### 数据流
```
[React前端] → HTTP POST /api/v1/reverse
    → [FastAPI路由] → SkillManager.load_skill()
                    → ModelManager.get_active_provider()
    → [PromptEngine] → Provider.generate()
    → [Response JSON] → [React显示结果]
```

### Skill 文件格式

每个 skill 是一个带 YAML frontmatter 的 Markdown 文件:

```markdown
---
name: minimax_h3
display_name: Minimax-H3
type: video_generation
version: 2.0.0
author: MiniMax Official (adapted for local LLM)
description: MiniMax H3 Video Generation Prompt Writing Guide
tags: [minimax, h3, video_generation, text_to_video, image_to_video, prompt_writing]
---

# MiniMax-H3 Video Prompt Writing Guide
...skill content in markdown...
```

### minimax_h3 Skill 目录结构 / Directory Structure

```
skills/minimax_h3/
├── skill.md                    # 主技能文件(含完整示例, ~14.5KB)
├── references/
│   ├── base-en.txt             # 基础模式(T2VA/I2VA/FL2VA/L2VA)完整指南
│   └── ref-en.txt              # 全参考模式(Ref2VA)完整指南
└── agents/
    └── openai.yaml             # 可选代理元数据
```

Skill 来源 / Source: [MiniMax-AI/MiniMax-H3](https://github.com/MiniMax-AI/MiniMax-H3)
覆盖5种生成模式: T2VA, I2VA, FL2VA, L2VA, Ref2VA

---

## 数据库表结构

### prompts 表
| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT | 用户定义标题 |
| content | TEXT | 提示词内容 |
| model_name | TEXT | 关联的模型名称 |
| category | TEXT | 自定义分类 |
| tags | TEXT (JSON) | 自定义标签数组 |
| is_favorite | BOOLEAN | 收藏标记 |
| source_type | TEXT | 来源: reverse/expand/manual/batch |
| source_media | TEXT (JSON) | 源文件路径 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 修改时间 |

### skill_overrides 表
| 列 | 类型 | 说明 |
|----|------|------|
| id | INTEGER PK | 自增主键 |
| skill_name | TEXT UNIQUE | 原始skill名称 |
| override_content | TEXT | 自定义skill内容 |
| description | TEXT | 修改说明 |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## REST API 设计

Base URL: `http://localhost:{PORT}/api/v1`

### 模型管理
| Method | Path | Description |
|--------|------|-------------|
| GET | `/models` | 列出可用模型(skills) |
| GET | `/models/active` | 获取当前活跃的provider |
| PUT | `/models/active` | 切换活跃provider |
| POST | `/models/test` | 测试provider连接 |

### 功能端点
| Method | Path | Description |
|--------|------|-------------|
| POST | `/reverse` | F1: 提示词反推 (multipart) |
| POST | `/expand` | F2: 提示词扩写 (JSON) |
| POST | `/batch/tag` | F3: 批量打标 (multipart) |
| GET | `/batch/status/{task_id}` | F3: 批量进度查询 |
| GET | `/library` | F4: 获取提示词列表 |
| POST | `/library` | F4: 保存提示词 |
| PUT | `/library/{id}` | F4: 更新提示词 |
| DELETE | `/library/{id}` | F4: 删除提示词 |
| GET | `/library/search` | F4: 搜索提示词 |
| GET | `/skills` | F5: 列出所有skills |
| GET | `/skills/{name}` | F5: 获取skill详情 |
| PUT | `/skills/{name}` | F5: 保存skill自定义 |

---

## 当前开发状态

- **当前阶段:** Phase 1 进行中 — 前后端集成、设置页面、打包完成
- **最后更新:** 2026-08-13 (Session 11: GPU 版 exe 打包成功 — llama_cpp + CUDA DLL 完整打包进 exe，本地模型 GPU 加速验证通过)
- **下一步任务:** 端到端测试 F1/F2 生成流程（已具备本地 GPU 模型 + 可用的在线 API）

### 已完成 (Phase 0 + Phase 1 部分)
- [x] 技术栈选型 + 产品架构设计
- [x] 完整项目脚手架 (backend/ 42文件 + frontend/ 18文件)
- [x] 后端 Provider: local / online / ollama（含路径解析修复 `_resolve_model_path()`）
- [x] 后端 API: models, config, reverse, expand, batch, library, skill, system
- [x] 后端 system API: `/system/check`, `/system/logs`, `/system/env`, `/system/models/scan`
- [x] 后端 workspace_manager + system_check + 启动诊断
- [x] 前端 6 个页面: Reverse, Expand, Batch, Library, SkillEditor, Settings
- [x] 前端 DebugConsole 调试面板
- [x] F1 提示词反推: 文件上传 + 需求描述输入 + 结果复制
- [x] F2 提示词扩写: Minimax-H3 专用交互
- [x] 设置页面: 本地/在线/Ollama/工作空间 4个Tab，测试连接，一键切换
- [x] 本地模型配置: 下拉选择（自动扫描 models/ 目录），含缩略图和自动匹配
- [x] i18n 翻译文件 4 个 (backend + frontend, zh + en)
- [x] Git 安全规范 + .gitignore 完善
- [x] PyInstaller 打包配置 (prompt_assistor.spec)
- [x] 一键启动: `start_app.bat` + `launcher.py`
- [x] **工作空间模型扫描修复:** 模块级 import 可变常量改为动态属性访问
- [x] **Provider 类型校验:** config/modal API 拒绝无效 provider 类型
- [x] **配置修复:** active_provider: "workspace" → "local"，清理非法条目
- [x] **MiniMax H3 Skill 本地化:** 从官方仓库下载并转换为本地可用的完整视频生成 Skill
- [x] **F2 模式/风格下拉:** 5种生成模式 + 16种视觉风格 Select 下拉选择器
- [x] **PyInstaller 自包含架构:** exe 内嵌 Python 运行时 + 全部依赖，双击即用，无需安装
- [x] **打包流程规范化:** 完整打包流程 + 验证检查清单写入 CLAUDE.md
- [x] **工作空间持久化:** 修复扁平键检测 + 默认路径显示 + 原生文件夹选择器
- [x] **GPU 版 exe 打包:** llama_cpp + CUDA DLL 完整打进 exe，本地模型 GPU 加速验证通过（Session 11）

### ⚠️ 已知问题

#### 问题 1: 工作空间与项目 Skills 目录隔离
- **现象:** 启用工作空间后，`SKILLS_DIR` 完全指向工作空间目录，项目 `skills/` 被忽略
- **影响:** 项目内置的 Skill 需要手动复制到工作空间
- **修复方向:** 让 SkillManager 同时扫描项目和工作空间的 skills 目录，或自动同步

#### 问题 2: llama-cpp-python 未打包进 exe ✅ 已解决 (Session 11)
- **现象:** 自包含 exe 中切换本地模型失败，提示 "llama-cpp-python is not installed"
- **原因:** llama-cpp-python 的 native DLL (`llama_cpp/lib/llama.dll`) 需要专门的 PyInstaller hook 才能正确收集
- **Session 11 解决:** 无需编写专门 hook —— 只需在 `prompt_assistor.spec` 中：
  1. 从 `excludes` 移除 `llama_cpp` / `llama_cpp_python`
  2. 在 `hiddenimports` 加入 `llama_cpp`（及关键子模块）
  3. 在 `datas` 收集 `llama_cpp/lib` 与 `nvidia/cu13/bin/x86_64`
  - 关键机理: llama-cpp-python 的 `_base_path` = `os.path.dirname(__file__)/lib`，
    冻结模式下即 `sys._MEIPASS/llama_cpp/lib`，因此 DLL 收集到该目标目录即可被加载。
  - 完整步骤见上方「GPU/CUDA DLL 收集」小节（含 `nvcudart_hybrid64.dll` 复制命令）。
  - **验证:** exe 内加载 Qwen3.5-9B Q4_K_M + mmproj，显存 6.5GB，F2 生成 ~4.7s ✅

---

## 会话日志

### 2026-08-13 (Session 11)
- **GPU 版 exe 打包成功 + 本地模型 GPU 加速验证通过 / GPU exe packaging + local model GPU verified:**
  - **用户需求:** 按 CLAUDE.md 打包流程重新打包 exe 以供测试，选择「GPU 完整版」——
    把 llama_cpp + CUDA DLL 一并打进 exe，使 exe 内可跑本地 GGUF 模型（GPU 加速）。
  - **核心突破:** 解决了 Session 8 遗留的「llama-cpp-python 未打包进 exe」问题，
    **无需编写专门 PyInstaller hook**。关键机理：llama-cpp-python 的 `_base_path` =
    `os.path.dirname(__file__)/lib`，冻结模式下即 `sys._MEIPASS/llama_cpp/lib`，
    并在加载时把该目录前置到 `PATH`。因此只需把 DLL 收集到对应目标目录即可。
  - **改动 (3 处):**
    1. 复制 `nvcudart_hybrid64.dll`（NVIDIA 驱动 DriverStore）→ `.venv/.../llama_cpp/lib/`
    2. `prompt_assistor.spec`：
       - `excludes` 移除 `llama_cpp` / `llama_cpp_python`
       - `hiddenimports` 加入 `llama_cpp` + 关键子模块
       - `datas` 收集 `nvidia/cu13/bin/x86_64` 与 `llama_cpp/lib`
    3. 前端重新构建（`npx vite build`，14.6s）
  - **打包结果:** `dist-exe/PromptAssistor.exe` **509MB**（原 25MB → +nvidia-cublas ~383MB + CUDA DLL）
  - **验证 (5 项全过):**
    - `GET /health` → 200 ✅
    - `GET /api/v1/system/models/scan` → 200 ✅
    - `GET /` → 200（前端 serve）✅
    - llama_cpp 正常导入（不再报 "not installed"，日志显示 `llama_context` 消息）✅
    - **GPU 加速确认:** `nvidia-smi` 显示 **6501 MiB 显存占用**（Qwen3.5-9B Q4_K_M 5.6GB
      + mmproj 918MB 已卸载到 GPU），F2 扩写生成完整 T2VA 提示词仅 **~4.7s** ✅
  - **附带发现 (与打包无关的既有 bug):** 本地模型无有效 `model_path` 时切换后端报
    `'NoneType' object has no attribute 'get'` —— 位于 `model_api.py` 的
    `get_active_provider_info().get("active", {}).get("type", "")`，
    当 `active` 为 `None` 时 `.get("active", {})` 返回 `None` 而非 `{}`。
  - **测试后清理:** 已 `taskkill` 关闭测试 exe，并删除 `dist-exe/data/`（运行时 config），
    exe 回到「全新」状态，双击即可正常启动。

### 2026-08-13 (Session 10)
- **本地模型 GPU 加速修复 (Blackwell sm_120 + CUDA 13.0) / Local model GPU acceleration fix:**
  - **用户需求:** 本地模型提示词扩写时 CPU 占用高但 GPU 无波动，接口超过 3 分钟无响应失败
  - **根因:** 用户显卡为 RTX 5060 Ti (Blackwell sm_120，compute capability 12.0)，
    要求 CUDA 12.8+/13.0。官方 PyPI 的 llama-cpp-python 是 cu12 构建，**不支持 sm_120**，
    因此 `gpu_layers=-1` 时回退到纯 CPU 推理。
  - **方案:** 安装 dougeeai 的 sm_120 CUDA 13.0 预编译 wheel（`0.3.20+cuda13.0.sm100.sm120`），
    源码: [dougeeai/llama-cpp-python-wheels](https://github.com/dougeeai/llama-cpp-python-wheels)
    （Blackwell 仅 CUDA 13 构建，驱动要求 580+，本机 596.21 满足）。
  - **关键依赖链 (Dependency chain):** dougeeai wheel 的 `ggml-cuda.dll` 动态依赖
    `cublas64_13.dll` 与 `nvcudart_hybrid64.dll`，二者**都不随 wheel 打包**：
    - `cublas64_13.dll` → 由 `nvidia-cublas` pip 包提供（`site-packages/nvidia/cu13/bin/x86_64/`）
    - `nvcudart_hybrid64.dll` → 由 NVIDIA 显示驱动自带（`C:\Windows\System32\DriverStore\FileRepository\nv_dispi.inf_*/`）
  - **修复 (两步):**
    1. venv 安装运行时: `pip install nvidia-cuda-runtime==13.0.96 nvidia-cublas==13.0.2.14`
       （仅影响虚拟环境，不影响全局；nvidia-cublas wheel 约 383MB）
    2. `local_provider.py` 新增 `_setup_cuda_dll_search()` — 在 `import llama_cpp` 前
       把上述 DLL 目录**前置到 `PATH` 环境变量**
  - **关键 Windows 技术坑 (CRITICAL):** llama-cpp-python 用 `ctypes.CDLL(winmode=RTLD_GLOBAL=0)`
    加载库，该模式**忽略 `os.add_dll_directory()` 注册的目录**，只认标准搜索顺序（含 `PATH`）。
    因此唯一可靠做法是改 `PATH`，而非 `add_dll_directory`。这是官方 cu12 wheel（静态链接单 DLL）
    不会遇到的问题——dougeeai wheel 使用新版 llama.cpp 动态后端（ggml.dll/ggml-cuda.dll 分离）。
  - **验证:** `llama_supports_gpu_offload()` → True；模型加载日志显示
    `using device CUDA0 (NVIDIA GeForce RTX 5060 Ti)`；9B Q4 模型 21s 加载、约 20 tok/s 生成 ✅
  - **⚠️ 注意:** 当前 GPU 加速仅在**源码/venv 开发模式**下生效。打包 exe 时仍需按 Session 8
    的已知问题 2 处理（llama-cpp-python 未打包进 exe），并额外收集上述 CUDA DLL。

### 2026-08-12 (Session 9)
- **`start_app.bat` 虚拟环境启动修复 / Venv launcher fix:**
  - **用户需求:** `start_app.bat` 启动时必须使用 `.venv` 虚拟环境，而非系统 Python
  - **第一版修改:** 显式 `%VENV_PYTHON%` / `%VENV_PIP%` 路径（移除 `call activate.bat`）→ 闪退
  - **第二版修改:** 恢复 `call activate.bat` + 添加 `chcp 65001` → 仍闪退
  - **根因:** Windows `cmd.exe` 默认使用 GBK (CP936) 解析 `.bat` 文件，UTF-8 编码的中文字符被错误解析导致脚本直接退出。"闪退"是编码问题，不是脚本逻辑问题。
  - **最终修复:** 重写为**纯 ASCII 编码**（移除所有中文字符），无 `chcp` 调用，使用 `%~dp0` 绝对路径
    - `call "%~dp0.venv\Scripts\activate.bat"` — 激活虚拟环境
    - `python "%~dp0launcher.py" %*` — 启动应用
    - 每步失败都有 `pause` + 错误提示
  - **重要经验 / Key lesson:** 项目下所有 Windows `.bat` 文件必须使用 ASCII 编码，不得包含中文/UTF-8 字符。
    项目参考脚本 `scripts/dev_backend.bat`、`scripts/setup_env.bat` 同样遵循此规则。
  - 验证: 双击启动成功 ✅

- **回退链 (Fallback Chain) 导致 Provider 配置被静默覆盖的 Bug 修复:**
  - **现象:** 用户配置 Active Provider 为 local（本地模型），但 `/api/v1/expand` 返回 `"Provider 'online' is not available"`
  - **根因链路 (Root Cause Chain):**
    1. App 启动 → `model_manager.initialize()` 读取 config: `active_provider = "local"`
    2. 尝试初始化 local provider → 失败（模型文件路径问题等）
    3. 触发回退链 → 尝试 `online` → `OnlineProvider.initialize()` **总是成功**
       （因为只创建 `AsyncOpenAI` HTTP client，不验证 API key 是否有效）
    4. 回退链仅检查 `_switch_provider()` 返回值（True = init 未抛异常），
       不验证 `is_available()` → 将 config 永久覆盖为 `active_provider: "online"`
    5. 用户请求 expand → `get_active_provider()` → `is_available()` 返回 False
       （无 API key，`models.list()` 调用失败）→ 抛出 "Provider 'online' is not available"
  - **修复 (model_manager.py:initialize):**
    回退链在 `_switch_provider()` 成功后，额外调用 `provider.is_available()` 验证：
    - 可用 → 保存到 config（回退成功）
    - 不可用 → **不保存 config**（保留用户原始偏好），继续尝试下一个回退
  - **修复补充 (第二次修复 — 内存状态污染):**
    第一次修复只防止了 config 覆盖，但**内存中的 `_active_provider_type` 仍被回退链污染**，
    导致 `get_active_provider()` 仍返回错误的 provider。第二次修复新增：
    1. 配置 provider 初始化成功后也验证 `is_available()`，不可用则 `_deactivate_provider()`
    2. 新增 `_deactivate_provider()` 辅助方法 — 关闭并移除不可用后端，清理 `_active_provider_type`
    3. 所有回退都不可用时，显式设置 `_active_provider_type = None`，确保无残留错误状态
  - **关键设计决策:** 回退后端的不可用状态不应覆盖用户配置。online/ollama provider
    的 `initialize()` 总是成功（仅创建 HTTP client），真正可用性由 `is_available()` 决定。

### 2026-08-12 (Session 8)
- **Provider 切换稳定性修复 (3个关联Bug修复):**

  **Bug 1: Expand 接口使用了错误的 Provider**
  - **现象:** 用户配置 Active Provider 为本地模型，但 `/api/v1/expand` 返回 "Provider 'online' is not available"
  - **根因:** `model_manager._switch_provider()` 旧逻辑先关闭旧 provider 再创建新 provider，新 provider 初始化失败（缺少依赖）后 `_active_provider_type` 被设置为失败的类型但无 provider 实例，状态彻底损坏
  - **修复 (3处改动):**
    1. `model_manager._switch_provider()` — 改为**先创建新 provider，成功后才关闭旧 provider**（事务性切换）；初始化失败时**不改变 `_active_provider_type`**，返回 False
    2. `model_manager.initialize()` — 新增**回退链**：配置的 provider 失败后依次尝试 online → ollama → local，直到某个成功；全部失败则以无 provider 状态运行
    3. `model_api.switch_provider()` — 切换失败时返回 `{"success": false, "active_provider": "<当前>", "message": "..."}` 而非 HTTP 500

  **Bug 2: 本地模型测试连接报错 "llama-cpp-python is not installed"**
  - **根因:** `llama-cpp-python` 的 native DLL (`llama_cpp/lib/llama.dll`) 无法被 PyInstaller 自动收集，导致 exe 启动时崩溃 (`FileNotFoundError: llama_cpp/lib`)
  - **修复:**
    - `llama-cpp-python` 已安装到 venv (`0.3.34`)，但**不打包进 exe**
    - `prompt_assistor.spec`: 从 hiddenimports 移除 `llama_cpp`，添加到 excludes 列表
    - `LocalProvider.initialize()` 延迟导入 `llama_cpp`，缺失时通过 `ProviderInitError` 明确报错
    - 未来如需在 exe 中支持本地模型，需编写 PyInstaller hook 收集 llama_cpp DLL

  **Bug 3: 工作空间路径保存后不回写输入框**
  - **根因:** `SettingsPage.loadConfig()` 每次刷新都调用 `setActiveTab(config.active_provider)`，导致保存工作空间后自动跳转到 provider 标签页
  - **修复:** `loadConfig()` 增加 `resetTab` 参数，仅初始加载 (`loadConfig(true)`) 时重置标签页；保存后刷新 (`loadConfig()`) 保持当前标签不变

- **前端 SettingsPage 工作空间保存兼容修复:**
  - `handleSave()` 增加 `isProviderTab` 判断 — 仅在 local/online/ollama 标签页才发送 `active_provider` 和 `providers.*` 字段
  - 工作空间标签页保存时只发送 `workspace.enabled` 和 `workspace.path`
  - 修复前端误发送 `active_provider: "workspace"` 导致后端 400 错误

- **已验证 (自包含 exe):**
  - `PUT /api/v1/models/active?provider_type=local` → `{"success": false, "active_provider": "online", ...}` ✅
  - `PUT /api/v1/config {"workspace.enabled": true, "workspace.path": "..."}` → `{"success": true}` ✅
  - exe 启动后默认使用 "online" provider，健康检查正常 ✅
  - ollama 包已打包进 exe ✅

### 2026-08-11 (Session 7)
- **自包含 exe 架构重构 (核心打包原则修正):**
  - **用户反馈:** "打包成exe意味着不用安装依赖环境，用户只要双击执行就能启动"
  - **旧架构问题:** Thin Launcher 模式要求用户安装 Python + pip install 依赖 → 违背 exe 意义
  - **新架构:**
    - `backend/run.py` — PyInstaller 入口点，进程内直接 `uvicorn.run()`，无需 subprocess
    - exe 内嵌: Python 3.12 运行时 + 所有 pip 依赖 + 全部后端代码 + 前端静态文件 + Skills
    - 仅 `models/` 为外部目录（GGUF 太大不嵌入）
    - 运行时 `data/`、`models/`、`output/` 在 exe 旁边自动创建
    - `prompt_assistor.spec` — 入口改为 `backend/run.py`，收集 40+ hiddenimports
    - `constants.py` — 新增 `IS_FROZEN` 分支，自动切换嵌入路径 vs 源码路径
    - `main.py` — 使用 `DEFAULT_STATIC_DIR` 替代硬编码 `BACKEND_ROOT / "static"`
  - **验证通过 (无 Python PATH 环境):**
    - exe 大小 ~25MB（自包含）
    - `GET /health` → 200 ✅
    - `GET /api/v1/system/models/scan` → 200 ✅
    - `GET /` → 200（前端从 `sys._MEIPASS/static/` serve）✅

- **工作空间功能修复 / Workspace Fixes:**
  - **持久化修复:** `config_api.py` 检测扁平键 `workspace.*` 前缀 → apply_workspace() 正确触发
  - **默认路径:** 配置 GET 响应注入 `app_home` (exe 目录)，前端显示为默认工作空间
  - **文件夹选择器:** `system_api.py` 新增 `POST /system/select-folder`，调用 tkinter 原生对话框
  - **前端:** SettingsPage 新增「浏览」按钮 + 默认路径提示

- **CLAUDE.md 打包规范重写:**
  - 新增核心原则: "exe 必须是完全自包含的"
  - 用户要求: 无需 Python、无需 pip install、双击即用
  - 架构图、路径处理说明、spec 关键配置
  - 5步打包流程（比旧版减少2步，不再需要复制外部目录）

### 2026-08-11 (Session 5)
- **工作空间模型扫描修复 (核心Bug修复):**
  - **根因:** `system_check.py`, `local_provider.py`, `skill_manager.py` 使用模块级
    `from app.constants import MODELS_DIR/SKILLS_DIR`，在 `workspace_manager.apply_workspace()`
    之前导入，捕获了默认项目路径而非工作空间路径
  - **修复:** 6个文件改为动态属性访问 (`import app.constants as consts` → `consts.MODELS_DIR`)
    - `backend/utils/system_check.py` — `_check_models_dir()` 和 `_check_skills_dir()`
    - `backend/providers/local_provider.py` — `_resolve_model_path()` 和错误提示
    - `backend/api/system_api.py` — `scan_models()` 端点
    - `backend/core/skill_manager.py` — `SkillManager.__init__()`
  - 验证: 源码运行正确扫描到工作空间 `E:\File\AIGC\PromptMaster\models` 下2个GGUF文件
    (Qwen3.5-9B Q4_K_M 5.4GB + mmproj 876MB)

- **配置修复 / Config Fixes:**
  - `config.json`: `active_provider: "workspace"` → `"local"`（无效值修复）
  - 删除 `providers.workspace` 条目（非法 provider）
  - 清理 `providers.local` 中交叉污染的无关字段

- **Provider 类型验证 / Provider Type Validation:**
  - `backend/api/config_api.py` — 写入 `active_provider` 和 `providers` 时校验合法性
  - `backend/api/model_api.py` — 硬编码字符串 → `VALID_PROVIDER_TYPES`(基于 enum)
  - `backend/core/model_manager.py` — 启动时检测无效 `active_provider`，自动回退并修复
  - 工作空间配置变更后自动重新 `apply_workspace()`

- **MiniMax H3 Skill 本地化 / Skill Localization:**
  - 从 [MiniMax-AI/MiniMax-H3](https://github.com/MiniMax-AI/MiniMax-H3) 官方仓库下载 skills
  - 完全重写 `skills/minimax_h3/skill.md` (14,509 字符, 297 行, v2.0.0):
    - type: `image_generation` → `video_generation`
    - 覆盖5种模式: T2VA, I2VA, FL2VA, L2VA, Ref2VA
    - 每种模式含完整可用示例
    - 包含镜头语言规范(运镜类型+幅度+速度公式)、对话/字幕/画外音规范、
      全参考模式6段式输出格式、风格模板
  - 参考文件: `references/base-en.txt` (15,995 bytes), `references/ref-en.txt` (23,894 bytes)
  - 复制到项目 `skills/minimax_h3/` 和工作空间 `E:\File\AIGC\PromptMaster\skills/minimax_h3/`
  - 更新 `skills/README.md`（中英双语）
  - SkillManager 正确发现并加载: 20/20内容检查通过

### 2026-08-10 (Session 4)
- **F1 提示词反推优化:**
  - 新增需求描述文本输入框（字数统计、placeholder提示）
  - 结果区新增一键复制按钮
- **F2 提示词扩写重构 (Minimax-H3专用):**
  - 目标时长: 正整数输入
  - 参考素材: 图片显示真实缩略图，视频/音频显示类型图标+文件名
  - @引用下拉: 带缩略图的下拉菜单
  - 素材引用条: 文本框上方可视化缩略图条，点击插入引用
  - 大文本输出框 + 复制按钮
- **设置页面创建:**
  - 4个Tab: 本地模型 / 在线API / Ollama / 工作空间
  - 快速切换后端按钮 + 测试连接 + 保存配置
- **本地模型下拉选择:**
  - 新增 `GET /api/v1/system/models/scan` — 扫描 models 目录
  - 源码模式测试成功: 扫描到 Qwen3.5-9B + Mmproj，自动配对
  - 前端改为 Select 下拉框 + 重新扫描按钮
- **路径解析修复:**
  - `local_provider.py` 新增 `_resolve_model_path()` 函数
  - 相对路径 → 先查 MODELS_DIR(工作空间) → 再查 PROJECT_ROOT
  - 错误提示显示完整解析路径
- **PyInstaller 打包调试:**
  - exe 可启动，前端正常加载
  - ⚠️ 扫描端点 404: uvicorn 导入的是 exe 内嵌旧代码，非外部 backend/ 目录
  - 已记录修复方案，下次优先解决

### 2026-08-09 (Session 3)
- **新增工作空间(Workspace)功能:**
  - 用户可指定系统目录作为工作空间
  - 工作空间可包含独立的 skills/、models/、output/ 目录
  - 工作空间在项目外 → 文件不提交Git → 保护隐私
  - 配置: `config.json` → `workspace.enabled` + `workspace.path`
  - 实现文件: `backend/core/workspace_manager.py` + `backend/app/constants.py` 路径覆盖
- **新增用户友好错误提示系统:**
  - `backend/utils/system_check.py` — 启动时自动检查:
    - Python版本 (≥3.11)
    - 必需/可选依赖包
    - Skills目录和有效文件
    - 本地模型文件
    - Provider配置有效性
    - 后端连接测试
  - 每个检查项包含: name, status(ok/warning/error), message, detail, fix
  - `GET /api/v1/system/check` — 系统检查API端点
  - `GET /api/v1/system/logs` — 最近日志查询
  - `GET /api/v1/system/env` — 环境信息查询
  - `GET /system-check` — 健康检查端点（含系统检查摘要）
- **新增调试控制台(DebugConsole):**
  - 侧边栏底部一键打开诊断面板
  - 显示后端连接状态（在线/离线）
  - 系统检查结果列表（带修复建议）
  - 实时日志查看器（深色终端风格）
  - 未连接后端时显示明确启动指引
- **前后端整合:**
  - FastAPI 直接 serve React前端静态文件 → 无需Electron也能测试
  - 前端构建到 `frontend/dist/` → 复制到 `backend/static/`
  - 一个命令启动: `python launcher.py` 或 `start_app.bat`
- **打包:**
  - 创建 `launcher.py` — Python启动器（启动后端+打开浏览器）
  - 创建 `start_app.bat` — Windows一键启动（自动检查/安装依赖）
  - 创建 `prompt_assistor.spec` — PyInstaller打包配置
  - 前端成功构建 (Vite, 16个产物文件)
- CLAUDE.md 更新: 工作空间 + 系统检查 + 调试控制台 + 会话日志

### 2026-08-09 (Session 2)
- **新增 i18n 国际化规范:**
  - APP 需支持中英文一键切换
  - 翻译文件目录: `backend/locales/` + `frontend/src/locales/`
  - 前端使用 Ant Design ConfigProvider + react-i18next
- **新增中英双语注释规范:**
  - 所有代码注释必须同时包含中英文
  - 格式: `中文描述 / English description`
- **新增打包分发规范:**
  - 使用 electron-builder 打包为 exe/dmg
  - 用户需安装 Python 3.11+ 和依赖
  - Python 代码以源码形式打包（可在目标机器上 pip install）
- **新增 Git 安全规范:**
  - 禁止提交 API密钥、.env、config.json、证书等敏感文件
  - 提供 `.env.example` 作为配置模板
  - 误提交敏感信息的应急处理流程
- **.gitignore 完善**
- CLAUDE.md 项目目录结构中新增 `locales/` 目录

### 2026-08-09 (Session 1)
- 创建项目仓库，初始提交 (LICENSE + README)
- 完成产品需求分析和架构设计
- 技术栈选型：用户选择方案B (Python Backend + Electron Frontend)
- **完成 Phase 0: 项目脚手架搭建**
  - 创建完整的 backend/ 目录 (32个Python文件)
  - 创建完整的 frontend/ 目录 (13个TS/TSX文件)
  - 创建 skills/minimax_h3/skill.md 示例Skill
  - 创建开发脚本 (Windows + macOS)
  - 创建 Python 虚拟环境
  - 所有模块遵循 Provider 模式和模块独立原则

---

## 快速启动

### 一键启动 (推荐 / Recommended)

**Windows — 双击 `start_app.bat`**

自动完成：检查Python → 创建/激活 `.venv` 虚拟环境 → 安装依赖 → 启动后端 → 打开浏览器。

```bash
# 等价于命令行执行:
start_app.bat
```

`start_app.bat` 执行流程 / Execution flow:
1. `cd /d "%~dp0"` — 切换到脚本所在目录（确保路径正确）
2. 检测系统 Python（`python --version`），未安装则提示并退出
3. 检测 `.venv`，不存在则 `python -m venv .venv` 自动创建
4. `call .venv\Scripts\activate.bat` — 激活虚拟环境
5. 检测 `fastapi` 可用性，缺失则 `pip install -r backend\requirements.txt`
6. `python launcher.py %*` — 启动应用

> **⚠️ 关键约束: `start_app.bat` 必须是纯 ASCII 编码（无中文字符）。**
>
> 中文 Windows 的 `cmd.exe` 默认使用 GBK (CP936) 代码页解析 `.bat` 文件。
> UTF-8 编码的中文字符会被 GBK 错误解析导致脚本"闪退"（窗口一闪而过）。
> `chcp 65001` 方案在部分 Windows 版本上不稳定，**纯 ASCII 是最可靠的写法**。
>
> ❌ 错误: UTF-8 编码 + 中文注释 → 闪退
> ✅ 正确: ASCII 编码 + 英文注释 → 稳定运行
>
> 参考: 项目下 `scripts/dev_backend.bat`、`scripts/setup_env.bat` 同样使用 ASCII 编码。

### 分别启动 (开发模式 / Development)
```bash
# 1. 后端 (Backend)
scripts\dev_backend.bat
# 浏览器访问 / Open: http://127.0.0.1:18720

# 2. 前端开发模式 (Frontend Dev Mode)
cd frontend
npm install
npx vite dev
# 浏览器访问 / Open: http://localhost:5173
```
