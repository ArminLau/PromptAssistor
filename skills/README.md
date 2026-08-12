# Skills 目录 / Skills Directory

此目录存放各生图/生视频模型的提示词编写指南(Skill)。
/ This directory contains prompt writing guides (Skills) for image/video generation models.

## 什么是 Skill / What is a Skill

Skill 是模型的提示词编写指南，它教会 LLM 如何为特定模型生成高质量的提示词。
/ A Skill is a prompt writing guide that teaches the LLM how to generate high-quality prompts for specific models.

每个 Skill 是一个带 YAML 元数据的 Markdown 文件，包含:
/ Each Skill is a Markdown file with YAML metadata, containing:
- 模型的特性和能力边界 / Model features and capability boundaries
- 提示词的结构规范 / Prompt structure specifications
- 示例提示词 / Example prompts
- 技巧和注意事项 / Tips and best practices

## 如何添加新 Skill / How to Add a New Skill

1. 在 `skills/` 下创建以模型名命名的文件夹 / Create a folder named after the model under `skills/`
2. 在该文件夹中创建 `skill.md` 文件 / Create a `skill.md` file in that folder
3. 按照标准格式填写 YAML frontmatter 和 Markdown 内容 / Follow the standard format for YAML frontmatter and content
4. 可选：添加 `references/` 参考文件和 `agents/` 配置 / Optional: add `references/` and `agents/` config
5. 重启 PromptAssistor 即可自动加载新 Skill / Restart PromptAssistor to auto-load

## Skill 文件格式 / Skill File Format

```markdown
---
name: model_name               # 英文标识 / Internal identifier
display_name: 模型显示名称      # UI中显示的名称 / Display name in UI
type: video_generation         # image_generation | video_generation
version: 1.0.0
author: 作者名 / Author
description: 简短描述 / Short description
tags: [tag1, tag2, tag3]
---

# 模型名称 提示词编写指南 / Model Name Prompt Writing Guide

## 概述 / Overview
...

## 提示词结构 / Prompt Structure
...

## 示例 / Examples
...
```

## 已安装的 Skills / Installed Skills

| Skill | 模型 / Model | 类型 / Type | 版本 / Version | 来源 / Source |
|-------|-------------|-------------|---------------|---------------|
| [minimax_h3](minimax_h3/skill.md) | MiniMax H3 | 视频生成 / Video Generation | 2.0.0 | [MiniMax-AI/MiniMax-H3](https://github.com/MiniMax-AI/MiniMax-H3) |

### minimax_h3 目录结构 / Directory Structure

```
minimax_h3/
├── skill.md                    # 主技能文件(含完整示例) / Main skill file (with examples)
├── references/
│   ├── base-en.txt             # 基础模式(T2VA/I2VA/FL2VA/L2VA)完整指南 / Base modes guide
│   └── ref-en.txt              # 全参考模式(Ref2VA)完整指南 / Full-reference mode guide
└── agents/
    └── openai.yaml             # 可选代理元数据 / Optional agent metadata
```

## 自定义 Skill / Customizing Skills

你可以在 Skill 维护功能(F5)中对官方 Skill 进行自定义修改:
/ You can customize official Skills in the Skill Editor (F5):
- 调整提示词结构以适配特定行业 / Adjust prompt structure for specific industries
- 添加行业术语和专业表达 / Add domain terminology
- 修改示例以匹配你的使用场景 / Modify examples for your use case
- 自定义修改保存在数据库中，不会覆盖原始文件 / Customizations saved in DB, not overwriting originals

自定义内容会自动优先于原始 Skill 使用。
/ Custom content automatically takes priority over the original Skill.
