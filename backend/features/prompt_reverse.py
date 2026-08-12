"""
F1: 提示词反推 (Prompt Reverse Engineering)

Analyzes input images/videos and generates the prompt that would create them.
Uses multimodal LLM to understand visual content and translate it into
model-specific prompt format.
"""

import logging

logger = logging.getLogger(__name__)


# System prompt template for reverse engineering
REVERSE_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长根据图片或视频反推其生成提示词。

## 目标模型 Skill 指南
以下是目标生成模型的提示词编写指南，你必须严格遵循这些规范来编写提示词：

{skill_content}

## 任务
根据用户提供的图片/视频，分析画面内容，反推出一个能生成类似内容的专业提示词。

## 输出要求
1. 提示词必须符合上述 Skill 指南中的结构和规范
2. 详细描述画面中的主体、环境、风格、光影、构图等要素
3. 如果画面中有多个主体，分别描述它们的关系
4. 输出格式整洁，仅输出提示词，不要包含解释性文字
{extra_context}"""


# Default user prompt for reverse engineering
REVERSE_USER_TEMPLATE = """请根据提供的图片/视频，分析并反推出能够生成该内容的专业提示词。

{extra_instructions}"""
