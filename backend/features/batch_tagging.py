"""
F3: 数据集批量打标 (Dataset Batch Tagging)

Batch processes multiple media files to generate tags and prompts.
Supports export to CSV/JSON formats.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# System prompt template for batch tagging
BATCH_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长为图片/视频数据集批量生成标签和提示词。

## 目标模型 Skill 指南
以下是目标生成模型的提示词编写指南，你必须严格遵循这些规范：

{skill_content}

## 任务
为提供的媒体文件生成结构化标签和提示词。

## 输出格式
请严格按照以下 JSON 格式输出（不要包含其他文字）：
```json
{{
  "tags": ["标签1", "标签2", "标签3", ...],
  "prompt": "生成的完整提示词",
  "category": "分类名称",
  "style_notes": "风格备注"
}}
```
{extra_context}"""


def export_results_to_csv(results: list[dict[str, Any]], output_path: str | Path) -> None:
    """
    Export batch tagging results to CSV format.

    Args:
        results: List of result dictionaries.
        output_path: Path for the output CSV file.
    """
    import csv

    output_path = Path(output_path)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        if not results:
            return

        # Use keys from first result as headers
        headers = list(results[0].keys())
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(results)

    logger.info(f"Exported {len(results)} results to CSV: {output_path}")


def export_results_to_json(results: list[dict[str, Any]], output_path: str | Path) -> None:
    """
    Export batch tagging results to JSON format.

    Args:
        results: List of result dictionaries.
        output_path: Path for the output JSON file.
    """
    output_path = Path(output_path)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    logger.info(f"Exported {len(results)} results to JSON: {output_path}")
