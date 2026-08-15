---
name: natural_prompt
display_name: Natural Language (自然语言)
type: image_generation
version: 1.0.0
author: PromptAssistor (compiled from official model guides)
description: >
  自然语言提示词扩写技能 / Natural language prompt writing skill.
  覆盖 Krea 2、Z-Image、FLUX.1、Qwen-Image 四种模型的自然语言提示词编写规范。
  适用于描述性成段提示词（非标签堆砌），支持单图或多图参考。
tags: [natural_language, image_generation, krea2, z_image, flux, qwen_image, prompt_writing]
updated: 2026-08-15
---

# 自然语言提示词编写指南 / Natural Language Prompt Writing Guide

## 概述 / Overview

本技能用于将简短需求扩写为「自然语言」风格的图片生成提示词。自然语言提示词使用完整的
描述性句子（而非逗号分隔的标签），对 Krea 2、Z-Image、FLUX.1、Qwen-Image 等现代文生图
模型效果最佳。

通用结构 / Common structure:
`[主体描述 Subject] + [动作/场景 Action & Context] + [光线氛围 Lighting] + [风格 Style] + [构图与质量 Composition & Quality]`

> ⚠️ 核心原则：**正向描述**（说清「要什么」），避免否定句式（说「不要什么」）——
> 除 Qwen-Image 等明确支持负向提示词的模型外，多数自然语言模型不识别负向提示词。

---

## 通用自然语言原则 / General Natural-Language Principles

| 原则 / Principle | 说明 / Explanation |
|------------------|-------------------|
| 描述要具体 / Be specific | 用「一只耳朵耷拉的金毛幼犬坐在门廊台阶上」代替「一只狗」 |
| 词序权重靠前 / Front-load | 扩散模型对提示词靠前的 token 权重更高，把最重要的主体放在最前面 |
| 光线影响最大 / Lighting matters | 光线是仅次于风格的最大杠杆，明确写出光源方向与氛围 |
| 正向而非否定 / Positive over negative | 用描述空白处的方式「挤掉」不想要的东西，而非直接否定 |
| 写清材质与纹理 / Materials & texture | 「旧皮革」「拉丝金属」「湿漉漉的柏油路」等提升真实感 |
| 避免风格冲突 / One primary style | 选一种主风格，最多加一两个不冲突的修饰词 |
| 需要文字时用直引号 / Quote text | 把要渲染的文字用 `"..."` 包起来，并描述字体风格 |

---

## 模型规范 / Model-Specific Rules

### Krea 2

> 官方指南 / Official guide: [krea-ai/krea-2/docs/prompting.md](https://github.com/krea-ai/krea-2/blob/main/docs/prompting.md)

Krea 2 官方推荐使用**自然语言提示词**生成图像（而非标签堆砌）。Turbo 模型最高可生成
**2K 分辨率**图像。**长而详细的提示词效果最佳**，但模型即使不做复杂的提示词工程，也能
用极简提示词生成高质量图像（minimal prompt engineering）。

- **详细长提示词优先**：描述越具体、越完整，结果的可控性与一致性越强；但简短提示词同样可用。
- **文字渲染**：需要模型生成文字时，用**直引号**把要渲染的文字包起来（如 `"KREA"`）。
- **建议结构**（提炼自官方示例 / derived from official examples）：
  `主体 + 景别/构图 + 光线 + 色彩 + 材质/媒介风格 + 景深/镜头`
- 官方示例的高频要素 / Recurring elements in official examples：
  - **景别与角度**：`close-up`、`extreme close-up`、`high-angle`、`low-angle`、
    `medium shot`、`tightly framed medium shot`。
  - **光线**：`studio lighting`、`soft directional studio lighting`、`golden hour`、
    `cinematic lighting`、`diffused natural light`、`hard direct lighting`。
  - **色彩**：`vibrant`、`muted`、`warm color palette`、`high contrast`、
    `solid [color] background`（纯色背景）。
  - **材质与媒介风格**：`digital painting`、`cel animation`、`vintage analog collage`、
    `macro photography`、`ink illustration`、`1980s airbrush aesthetic`、
    `painterly brushstrokes`。
  - **景深/镜头**：`shallow depth of field`、`macro lens`、`film grain texture`。
- 可借助 LLM 生成更长提示词：官方提供 [expansion.txt](https://github.com/krea-ai/krea-2/blob/main/docs/expansion.txt)
  作为系统提示词使用。

### Z-Image / Z-Image-Turbo

> 通义万相开源文生图模型；Turbo 为 8 步蒸馏版本 / Tongyi Wanxiang open-source text-to-image
> model; Turbo is the 8-step distilled variant.

- 用**自然语言长描述**，不要逗号堆砌标签，拒绝 `(xxx:1.2)` 这类权重语法。
- **官方 6 段式结构**：
  `主体人物/物体 → 细节/材质/服饰 → 姿态动作 → 场景环境 → 光照条件 → 摄影/渲染参数`。
- **优先写可见、具象的客观描述**，少用「绝美 / 史诗 / 顶级画质」等空洞抽象形容词；
  重点补充材质反光、面料纹理、褶皱、光影反射、环境细节。
- **Turbo 是 8 步蒸馏模型，guidance_scale 固定为 0，不生成、不输出负向提示词（negative prompt）**。
- 人像题材重点：皮肤质感、衣料纹理、丝袜/面料光泽褶皱、高光反射；环境补充光源来源、阴影软硬。
- 双语文字渲染是强项：用直引号包住要渲染的文字（如 `"新年快乐"`）并指明字体特征，文字保持简短。
- 支持中文输入输出，优先中文，摄影参数保留英文专业术语（如 `50mm f/1.8`、`Kodak Portra400`）。

**输出示例 / Output example**

> 用户输入 / User: `女人坐在沙发，灰色丝袜`
>
> 一位优雅年轻白人女性，蓬松金棕色大波浪长卷发，五官精致柔和浅笑，侧坐在米黄色花卉暗纹
> 布艺沙发上，双腿优雅交叉叠放，手轻搭膝盖正视镜头；身穿灰色竖罗纹高领针织包臀短裙，
> 腿上穿着烟灰色珠光薄款连裤丝袜，丝滑缎面材质，柔和环境光在袜面流淌细腻光泽，膝盖弯曲处
> 形成自然松弛褶皱，薄透面料隐约透出腿部肤色，脚上穿着亮黑色漆皮尖头细高跟；居家客厅环境，
> 一旁摆放大型龙血树绿植，陶土花盆，黑色金属玻璃边几，原木矮柜，米黄色半透落地窗帘，
> 柔和窗户漫射自然光，温暖室内氛围，阴影柔和自然；8K 写实摄影，50mm f/1.8 镜头，
> Kodak Portra400 胶片，极高细节，皮肤真实纹理，丝袜高光褶皱、漆皮鞋反光清晰，中景人像构图。

### FLUX.1

Black Forest Labs 官方指南的核心要点：

- 结构：`Subject + Action + Style + Context`（可选加 Lighting + Technical details）。
- **不支持负向提示词**——永远描述你想要什么。
- 使用自然语言成句，而非逗号分隔的关键词列表。
- **词序很重要**：最重要的元素放在最前面（主体 → 动作 → 风格 → 环境）。
- **明确写出光线**：golden hour、overcast、rim light、Rembrandt lighting、
  volumetric fog、neon glow、chiaroscuro 等。
- 长度建议（最多 512 token）：短 10–30 词（简单想法）、中 30–80 词（多数场景的甜点区）、
  长 80+ 词（多主体或技术性要求，谨慎使用）。
- 文字用直引号包住：`the text "BELLA'S BAKERY" in elegant serif typography`。
- 精确颜色用十六进制：`#RRGGBB` 加颜色描述。
- 可写相机参数：f/1.8（背景虚化）、f/8（全景清晰）、24mm（广角）、85mm（长焦）、ISO。

### Qwen-Image

阿里云通义千问文生图模型，擅长复杂文字渲染与多风格。

- 结构：`Subject + Style/Medium + Lighting/Mood + Composition + Quality Modifiers`。
- 上限约 1300 token，鼓励充分使用 token 预算写出更长的详细描述。
- 文字渲染极强：要渲染的文字用双引号包住，明确字体层级、语言与可读性要求。
- 官方支持 `negative_prompt`（≤500 字符，自动截断）与 `prompt_extend`（默认开启的智能
  扩写；关闭可获得更严格的控制）。
- 对结构化/文字多的画面：先描述成品载体（海报/信息图/分镜），再设信息层级与视觉约束。
- 明确空间关系（左右、前后、遮挡），模型对复杂空间推理能力强。

---

## 输出格式要求 / Output Format

1. 仅输出一段（或少数几段）自然语言描述，**不使用逗号分隔的标签堆砌**。
2. 保持用户需求的核心主体与意图不变，在此基础上补充风格、光线、构图、材质等专业细节。
3. 若需求描述中包含 `<Picture N>` 引用，请结合对应参考图片的实际内容来写，使结果与图片
   强相关（例如沿用图片中的构图、主体特征、色调）。
4. 控制输出长度在指定的「扩写长度」范围内（若无指定，默认约 100–300 字符）。
5. 使用目标模型所偏好的语言（中文或英文），必要时附上风格术语的英文原文。

---

## 完整示例 / Complete Examples

**示例 1 — FLUX.1（电影感人像）/ Example 1 — FLUX.1 cinematic portrait**

> A woman with silver hair in a flowing red dress walks along a wet city street at
> golden hour, rim light tracing her silhouette, shallow depth of field at f/1.8,
> teal-and-orange color grading, cinematic film still.

**示例 2 — Z-Image（双语文字海报）/ Example 2 — Z-Image bilingual text poster**

> 一张红色中国春节海报，正中央是 "新年快乐" 四个金色毛笔书法字，四周环绕梅花与红灯笼，
> 传统水墨画风格，柔和暖光，高细节。

**示例 3 — Qwen-Image（产品摄影）/ Example 3 — Qwen-Image product shot**

> A minimalist product photograph of a matte black ceramic coffee cup on a light oak
> table, 45-degree golden-hour sunlight from the upper left, soft shadows, shallow
> depth of field, professional studio lighting, 8K, sharp focus.

**示例 4 — Krea 2（探索式，先风格后收窄）/ Example 4 — Krea 2 exploratory**

> A lone astronaut walking through a field of glowing blue flowers, retro cartoon
> illustration style, dreamy atmosphere, soft pastel color palette.

---

## 你的任务 / Your Task

1. 读取用户的需求描述（`short_prompt`）与目标模型类型，确定要遵循哪一小节的规范。
2. 若用户提供了参考图片（需求中的 `<Picture N>`），请结合图片实际内容进行扩写。
3. 按目标模型的规范，将需求扩写为一段结构清晰、细节丰富的自然语言提示词。
4. 仅输出最终提示词文本，不要输出解释、标题或多余说明。
