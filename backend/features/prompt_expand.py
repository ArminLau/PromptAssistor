"""
F2: 提示词扩写 (Prompt Expansion)

Takes a short user prompt and expands it into a detailed, professional prompt
following the target model's skill guidelines.
"""

import logging

logger = logging.getLogger(__name__)


# System prompt template for expansion
EXPAND_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长将简短提示词扩展为详细、高质量的专业提示词。

## 目标模型 Skill 指南
以下是目标生成模型的提示词编写指南，你必须严格遵循这些规范来编写提示词：

{skill_content}

## 任务
将用户提供的简短提示词扩展为一个完整的、专业的提示词。

## 输出要求
1. 保持原提示词的核心意图和主体不变
2. 按照 Skill 指南中的结构补充以下细节：
   - 主体的详细描述
   - 环境与背景
   - 风格与技法
   - 光影与色彩
   - 构图与技术参数
3. 添加合适的画质关键词
4. 输出格式整洁，仅输出扩展后的提示词
{extra_context}"""


# Expansion styles
EXPANSION_STYLES = {
    "Balanced": "均衡扩展，保持适中的细节程度",
    "Minimal": "精简扩展，只添加必要的核心细节",
    "Maximum Detail": "最大化细节，添加丰富的描述和修饰",
    "Cinematic": "电影风格，强调电影级画面感和氛围",
    "Artistic": "艺术风格，强调艺术表现力和创意元素",
}
