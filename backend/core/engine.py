"""
Prompt engine for PromptAssistor.

Orchestrates the prompt generation flow:
1. Loads the appropriate skill for the target model
2. Builds the system prompt by combining feature template + skill content
3. Calls the active LLM provider
4. Post-processes and returns the result
"""

import logging
from typing import Any

from providers.base import BaseProvider, InferenceResult, ProviderNotAvailableError

logger = logging.getLogger(__name__)


class PromptEngine:
    """
    Core engine for generating prompts using skills and LLM providers.

    This is the central orchestrator that all features use.
    It combines: feature template + model skill + user input → final prompt → LLM → result

    Usage:
        engine = PromptEngine(skill_manager, model_manager)
        result = await engine.generate(
            feature="reverse",
            skill_name="minimax_h3",
            user_text="analyze this image",
            images=["/path/to/image.png"],
        )
    """

    def __init__(self, skill_manager, model_manager):
        """
        Initialize the prompt engine.

        Args:
            skill_manager: SkillManager instance for loading skills.
            model_manager: ModelManager instance for accessing providers.
        """
        self._skill_manager = skill_manager
        self._model_manager = model_manager

    async def generate(
        self,
        feature: str,
        skill_name: str,
        user_text: str,
        images: list[str] | None = None,
        audio: list[str] | None = None,
        video: list[str] | None = None,
        extra_context: str = "",
        **kwargs: Any,
    ) -> InferenceResult:
        """
        Generate a prompt using the specified feature, skill, and inputs.

        Args:
            feature: Feature identifier ("reverse", "expand", "batch").
            skill_name: Name of the skill to use (e.g., "minimax_h3").
            user_text: User's input text.
            images: Optional list of image file paths.
            audio: Optional list of audio file paths.
            video: Optional list of video file paths.
            extra_context: Additional context or instructions.
            **kwargs: Additional parameters passed to the provider.

        Returns:
            InferenceResult with the generated text.

        Raises:
            ValueError: If the feature is unknown.
            ProviderNotAvailableError: If no provider is available.
            SkillNotFoundError: If the skill is not found.
        """
        # 1. Load the skill
        skill_content = self._skill_manager.get_skill_content(skill_name)

        # 2. Build system prompt
        system_prompt = self._build_system_prompt(feature, skill_name, skill_content, extra_context)

        # 3. Build user prompt
        user_prompt = self._build_user_prompt(feature, user_text, extra_context)

        # 4. Get the active provider
        provider = await self._model_manager.get_active_provider()

        # 5. Generate
        logger.info(
            f"Generating prompt: feature={feature}, skill={skill_name}, "
            f"provider={provider.provider_type.value}, "
            f"images={len(images) if images else 0}, "
            f"audio={len(audio) if audio else 0}, "
            f"video={len(video) if video else 0}"
        )

        result = await provider.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            images=images,
            audio=audio,
            video=video,
            **kwargs,
        )

        logger.info(f"Generation complete: {len(result.text)} chars, {result.tokens_used} tokens")
        return result

    async def generate_batch(
        self,
        feature: str,
        skill_name: str,
        items: list[dict[str, Any]],
        progress_callback=None,
    ) -> list[InferenceResult]:
        """
        Generate prompts for multiple items in batch.

        Args:
            feature: Feature identifier.
            skill_name: Name of the skill to use.
            items: List of dicts, each with keys: user_text, images, audio, video.
            progress_callback: Optional async callback(current_index, total, result).

        Returns:
            List of InferenceResult objects.
        """
        results: list[InferenceResult] = []
        total = len(items)

        for i, item in enumerate(items):
            try:
                result = await self.generate(
                    feature=feature,
                    skill_name=skill_name,
                    user_text=item.get("user_text", ""),
                    images=item.get("images"),
                    audio=item.get("audio"),
                    video=item.get("video"),
                    extra_context=item.get("extra_context", ""),
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Batch item {i + 1}/{total} failed: {e}")
                results.append(
                    InferenceResult(
                        text=f"[Error: {e}]",
                        finish_reason="error",
                    )
                )

            if progress_callback:
                await progress_callback(i + 1, total, results[-1])

        return results

    def _build_system_prompt(
        self,
        feature: str,
        skill_name: str,
        skill_content: str,
        extra_context: str,
    ) -> str:
        """Build the system prompt by combining feature template with skill content."""
        templates = {
            "reverse": REVERSE_SYSTEM_TEMPLATE,
            "expand": EXPAND_SYSTEM_TEMPLATE,
            "batch": BATCH_SYSTEM_TEMPLATE,
        }

        template = templates.get(feature, DEFAULT_SYSTEM_TEMPLATE)

        skill_info = self._skill_manager.get_skill(skill_name)
        return template.format(
            skill_name=skill_info.display_name,
            skill_content=skill_content,
            extra_context=extra_context,
        )

    def _build_user_prompt(
        self,
        feature: str,
        user_text: str,
        extra_context: str,
    ) -> str:
        """Build the user prompt based on feature type."""
        templates = {
            "reverse": "请根据提供的图片/视频，分析并反推出能够生成该内容的专业提示词。",
            "expand": f"请将以下简短提示词扩展为详细、专业的提示词：\n\n{user_text}",
            "batch": f"请为以下内容生成标签和提示词：\n\n{user_text}",
        }
        base = templates.get(feature, user_text)

        if extra_context:
            base += f"\n\n补充说明：{extra_context}"

        return base


# ─── System Prompt Templates ───────────────────────────────────────────

REVERSE_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长根据图片或视频反推其生成提示词。

## 目标模型 Skill 指南
以下是目标生成模型 **{skill_name}** 的提示词编写指南，你必须严格遵循这些规范来编写提示词：

{skill_content}

## 任务
根据用户提供的图片/视频，分析画面内容，反推出一个能生成类似内容的专业提示词。

## 输出要求
1. 提示词必须符合上述 Skill 指南中的结构和规范
2. 详细描述画面中的主体、环境、风格、光影、构图等要素
3. 输出格式整洁，仅输出提示词，不要包含解释性文字
{extra_context}"""

EXPAND_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长将简短提示词扩展为详细、高质量的专业提示词。

## 目标模型 Skill 指南
以下是目标生成模型 **{skill_name}** 的提示词编写指南，你必须严格遵循这些规范来编写提示词：

{skill_content}

## 任务
将用户提供的简短提示词扩展为一个完整的、专业的提示词。

## 输出要求
1. 保持原提示词的核心意图和主体不变
2. 按照 Skill 指南中的结构补充细节
3. 添加合适的风格、光影、构图等专业描述
4. 输出格式整洁，仅输出扩展后的提示词
{extra_context}"""

BATCH_SYSTEM_TEMPLATE = """你是一位专业的提示词工程专家，擅长为图片/视频数据集批量生成标签和提示词。

## 目标模型 Skill 指南
以下是目标生成模型 **{skill_name}** 的提示词编写指南，你必须严格遵循这些规范：

{skill_content}

## 任务
为提供的媒体文件生成结构化标签和提示词。

## 输出要求
以 JSON 格式输出，包含：
- tags: 标签列表
- prompt: 生成的提示词
- category: 分类
{extra_context}"""

DEFAULT_SYSTEM_TEMPLATE = """你是专业的提示词工程专家。

## Skill 指南
{skill_content}

请根据用户输入生成专业的提示词。
{extra_context}"""
