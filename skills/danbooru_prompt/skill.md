---
name: danbooru_prompt
display_name: Danbooru Tags (Danbooru标签)
type: image_generation
version: 1.0.0
author: PromptAssistor (compiled from official model guides)
description: >
  Danbooru 标签提示词扩写技能 / Danbooru tag prompt writing skill.
  覆盖 Anima、SDXL 两种动漫模型的 Danbooru 风格标签提示词编写规范。
  输出逗号分隔的 booru 标签（而非自然语言句子），适用于动漫/二次元图像生成。
tags: [danbooru, anime, image_generation, anima, sdxl, tags, prompt_writing]
updated: 2026-08-15
---

# Danbooru 标签提示词编写指南 / Danbooru Tag Prompt Writing Guide

## 概述 / Overview

本技能用于将简短需求扩写为「Danbooru 风格标签」提示词。Booru 标签是来自动漫图库
（Danbooru / Gelbooru / Safebooru）的结构化、逗号分隔关键词，**不是自然语言句子**。
Anima、SDXL 动漫微调模型（Illustrious XL、Pony、Animagine、NoobAI 等）在 booru 标签
数据集上训练，对标签的响应远好于自然语言。

---

## 通用标签顺序 / General Tag Order

```
[质量/元/年份/安全标签] [主体数量] [角色] [系列] [画师] [通用标签]
[quality/meta/year/safety] [subject count] [character] [series] [artist] [general]
```

各部分内部标签顺序可任意。关键标签类别 / Core tag categories：

| 类别 / Category | 示例 / Examples |
|-----------------|-----------------|
| 质量 / Quality | `masterpiece`, `best quality`, `highres`, `absurdres` |
| 评分 / Score（Pony 系） | `score_9`, `score_8_up`, `score_7_up` |
| 年代 / Date | `newest`, `recent`, `mid`, `early`, `old`, `year 2025` |
| 安全 / Rating | `safe`, `sensitive`, `nsfw`, `explicit` |
| 主体数量 / Subject count | `1girl`, `1boy`, `2girls`, `solo`, `no humans` |
| 元 / Meta | `anime screenshot`, `official art`, `jpeg artifacts` |

---

## 格式规则 / Formatting Rules

- **小写 + 空格**（而非下划线）：`red hair`，**不是** `red_hair`。
- 唯一保留下划线的例外：`score_*` 标签（`score_7`, `score_9`）。
- 标签与 Gelbooru 冲突时，优先用 Gelbooru 版本。
- 多角色时**按角色分组**描述（角色 A 的全部特征 → 角色 B 的全部特征），避免特征交叉串色。
- 每个身体部位细节标签 ≤2 个，避免矛盾标签。
- 加权语法 `(tag:2)`：普通强调从 `(tag:2)` 起，强强调 `(tag:3)` 到 `(tag:5)`。

---

## 模型规范 / Model-Specific Rules

### Anima

CircleStone Labs × Comfy Org 的 2B 参数动漫文生图模型，专为插画/动漫设计，不适合写实。

- 官方标签顺序：`[质量/元/年份/安全] [1girl/1boy/1other] [角色] [系列] [画师] [通用标签]`。
- **画师标签必须加 `@` 前缀**：`@artist name`（不加 `@` 时画师风格几乎无效）。
- 推荐正向前缀：`masterpiece, best quality, score_7, safe,`。
- 推荐负向提示词：`worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration`。
- 权重需比典型 SDXL 更高（2–5 起步），例如 `(chibi:2)`。
- 训练时使用随机标签丢弃（random tag dropout），无需把每个相关标签都写全。

**标签 + 自然语言三层混合结构（Hybrid）**：

1. **硬标签（Hard Tags）** — 已确认的 Danbooru 标签：质量/年份/安全、`1girl`/`1boy`、
   角色、系列、`@artist`、外观/服装/道具、简单姿态/表情/场景（`sitting`, `smile`, `classroom`）。
2. **软短语（Soft Phrases）** — 不查 Danbooru 的短视觉/情绪/环境短语：`horsing around`、
   `surprised giggling`, `cherry blossom blizzard`。
3. **自然语言块（NL Tags Block）** — 语法连通的描述，用于构图/光线/色彩/空间布局/
   景深/多角色归属，例如 `Use a close-up two-shot focusing on...`。

> ⚠️ 自然语言的强度远大于标签：若用自然语言描述了背景，模型可能忽略 `close-up`/`upper body`
> 等构图标签而生成全景。此时需给构图标签加权以保持约束。

**冲突标签检查（生成前需解决）**：`solo` vs 多角色、`close-up` vs `full body`、
`from above` vs `from below`、`from front` vs `from behind`、`closed eyes` vs `looking at viewer`。

### SDXL

SDXL 基础模型偏自然语言，但主流动漫微调模型（Illustrious XL、Pony V6、Animagine XL、
NoobAI、Kohaku XL）都深度训练于 Danbooru 标签，booru 标签通常优于自然语言。

- 结构同通用顺序：`[质量/元/年份/安全] [主体数量] [角色] [系列] [画师] [通用标签]`。
- 标签经济的优势：避免 `the`/`is`/`with` 等虚词浪费 token；`purple_eyes` 直接映射到
  单一视觉概念，减少颜色串扰。
- 多角色按角色分组，每组内 `角色名 + 系列 + 发色 + 瞳色 + 服装 + 体型 + 表情` 完整描述。
- 负向提示词常用：`lowres, bad anatomy, bad hands, text, error, missing finger,
  extra digits, cropped, worst quality, low quality, signature, watermark, blurry,
  artist name, speech bubble, comic`。
- 采样建议（以 AnimaTensor 为例）：Euler a、28–35 步（推荐 30）、CFG 4–5（推荐 4.5）。
- 分辨率：训练约 1024×1024，建议略高于此并用 hires-fix。

> Danbooru 数据严重偏向女性角色（`1girl` 约是 `1boy` 的 4.3 倍，单人图约 81% 为女性）。
> 若用户想要男性、场景或无人物画面，需**显式**写出 `1boy`/`no humans` 等标签并在负向
> 提示词中排除不想出现的元素。

---

## 冲突标签对照表 / Conflicting Tags (avoid together)

| 标签 A / Tag A | 标签 B / Tag B | 原因 / Reason |
|----------------|----------------|---------------|
| `solo` | `1boy` / `2girls` / `hetero` | 单人图不可能有互动 |
| `sleeping` / `unconscious` | `looking at viewer` | 无意识者不能看镜头 |
| `blindfold` | `glasses` | 物理冲突 |
| `completely nude` | 任何具体服装标签 | 全裸意味着无服装 |
| `open mouth` | `closed mouth` / `clenched teeth` | 嘴不能同时开与合 |
| `spread legs` | `legs together` | 腿不能同时张开与并拢 |
| `pantyhose` | `barefoot` | 穿连裤袜就不可能赤脚 |

---

## 输出格式要求 / Output Format

1. 仅输出一行（或少数几行）**逗号分隔的标签列表**，不使用自然语言成句。
2. 标签顺序遵循：`质量/元/年份/安全 → 主体数量 → 角色 → 系列 → 画师 → 通用标签`。
3. 全部使用小写 + 空格（`red hair`），仅 `score_*` 保留下划线；画师标签加 `@` 前缀。
4. 若需求中引用 `<Picture N>` 参考图片，请结合图片实际内容（角色发色/瞳色/服装/构图）生成
   对应标签，使结果与图片强相关。
5. 输出长度控制在指定「扩写长度」范围内（标签数量适度，避免堆砌）。
6. 可另附一段负向提示词（如适用），标注为 `Negative:`。

---

## 完整示例 / Complete Examples

**示例 1 — Anima（单人角色）/ Example 1 — Anima single character**

```
masterpiece, best quality, score_7, safe,
1girl, hatsune miku, vocaloid, @user 12345,
long turquoise twintails, blue eyes, white sleeveless shirt, black pleated skirt,
standing, smile, looking at viewer, classroom, afternoon sunlight, cherry blossom petals
Negative: worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts
```

**示例 2 — SDXL（双角色，按角色分组）/ Example 2 — SDXL two characters**

```
masterpiece, best quality, highres, safe, 2girls,
rem, re:zero, blue hair, short hair, maid headdress, black dress, red eyes,
ram, re:zero, pink hair, short hair, maid headdress, black dress, red eyes,
face to face, smile, outdoors, garden, from side, sunset
Negative: lowres, bad anatomy, bad hands, worst quality, low quality, signature, watermark
```

**示例 3 — 场景（无人物）/ Example 3 — scenery, no humans**

```
masterpiece, best quality, highres, safe, no humans,
landscape, mountain, lake, cherry blossom, blue sky, clouds, spring,
scenery, outdoors, detailed background, from above
Negative: 1girl, 1boy, person, human, lowres, worst quality
```

---

## 你的任务 / Your Task

1. 读取用户的需求描述（`short_prompt`）与目标模型类型，确定遵循 Anima 或 SDXL 小节规范。
2. 若用户提供参考图片（`<Picture N>`），结合图片实际内容生成角色/场景对应标签。
3. 将需求扩写为符合标签顺序与格式规则的逗号分隔标签列表。
4. 检查并避免矛盾标签；如适用附上负向提示词。
5. 仅输出最终提示词文本，不要输出解释、标题或多余说明。
