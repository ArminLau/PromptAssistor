# Models 目录

此目录用于存放本地 LLM 模型文件（GGUF 格式）。

## 目录结构

每个模型应放在独立的子文件夹中，文件夹名建议使用模型名称：

```
models/
├── Qwen3.5-9B-abliterated/
│   ├── Qwen3.5-9B-abliterated-Q4_K_M.gguf
│   └── Qwen3.5-9B-abliterated.mmproj-f16.gguf    # 多模态投影器(可选)
├── Your-Model-Name/
│   ├── model-file.gguf
│   └── mmproj-file.gguf                           # 可选
└── README.md
```

## 支持的模型格式

- **GGUF 格式:** 适用于本地推理（通过 llama-cpp-python 加载）
- **多模态模型:** 需要同时放置 .gguf 模型文件和 .mmproj 投影器文件

## 获取模型

推荐从以下来源下载 GGUF 格式模型：

- [Hugging Face](https://huggingface.co/) - 搜索 "GGUF"
- [Ollama Library](https://ollama.com/library) - 可通过 Ollama 下载后导出

## 多模态模型推荐

| 模型 | 特点 | 推荐量化 |
|------|------|----------|
| Qwen2.5-VL | 中文视觉理解强 | Q4_K_M |
| LLaVA 1.6 | 通用视觉理解 | Q4_K_M |
| CogVLM2 | 视觉问答 | Q4_K_M |

## 注意事项

- 模型文件通常较大(数GB)，请确保有足够磁盘空间
- 此目录下的文件已被 .gitignore 忽略，不会提交到Git仓库
- 本地模型推理需要较多RAM/VRAM，建议至少16GB RAM
- 如果本地模型不可用，可以使用在线API或Ollama作为替代
