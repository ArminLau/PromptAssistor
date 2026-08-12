"""
F4: 提示词维护 (Prompt Library)

Manages the user's prompt collection:
- Save prompts from any feature
- Favorite/bookmark prompts
- Tag and categorize
- Search and filter
- Export/import

This feature is model-agnostic — it stores prompts without tying to specific LLM backends.
"""

import logging

logger = logging.getLogger(__name__)


# Category suggestions for prompt organization
DEFAULT_CATEGORIES = [
    "人像",
    "风景",
    "产品",
    "建筑",
    "科幻",
    "奇幻",
    "动物",
    "食物",
    "抽象",
    "其他",
]

# Common tag suggestions
SUGGESTED_TAGS = [
    "写实",
    "插画",
    "3D",
    "概念艺术",
    "电影级",
    "极简",
    "复古",
    "未来主义",
    "日系",
    "欧美",
    "中国风",
    "暗调",
    "明亮",
    "人像",
    "风景",
]
