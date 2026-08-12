---
name: minimax_h3
display_name: MiniMax-H3
type: video_generation
version: 2.0.0
author: MiniMax Official (adapted for local LLM)
description: >
  MiniMax H3 视频生成提示词编写技能 / MiniMax H3 Video Generation Prompt Writing Skill.
  支持 T2VA(文生视频), I2VA(图生视频), FL2VA(首尾帧生视频), L2VA(尾帧生视频),
  Ref2VA(全参考生视频) 五种模式的专业提示词编写。
  包含完整的镜头语言、画面描述、音效设计、参考标签等规范。
tags: [minimax, h3, video_generation, text_to_video, image_to_video, prompt_writing]
updated: 2026-08-11
---

# MiniMax H3 视频生成提示词编写指南 / H3 Video Prompt Writing Guide

## 概述 / Overview

MiniMax H3 是一个通用全模态视频生成模型，支持通过文本、图片、视频和音频
等多模态输入生成最长15秒、最高2K分辨率、带原生立体声音频的视频。

本技能用于指导如何为 H3 编写专业的视频生成提示词，涵盖五种生成模式。

### 五种生成模式 / Five Generation Modes

| 模式 | 全称 | 输入 | 说明 / Description |
|------|------|------|-------------------|
| T2VA | Text to Video/Audio | 纯文本 | 从文本构建完整视听时间线 / Build full audiovisual timeline from text |
| I2VA | Image to Video/Audio | 文本 + 1张首帧图 | 从首帧图片出发向前发展 / Start from first frame and develop forward |
| FL2VA | First-Last to Video/Audio | 文本 + 首帧图 + 尾帧图 | 描述首帧到尾帧的连续变化路径 / Describe path between first and last frames |
| L2VA | Last to Video/Audio | 文本 + 1张尾帧图 | 推断开头并逐渐收敛到尾帧 / Infer opening and converge to last frame |
| Ref2VA | Reference to Video/Audio | 文本 + 多图+视频+音频(最多12个文件) | 全参考模式，支持复杂多模态参考 / Full-reference with multi-modal references |

---

## 基础模式提示词结构 / Base Mode Prompt Structure

适用 T2VA, I2VA, FL2VA, L2VA / Applies to T2VA, I2VA, FL2VA, L2VA

### 输出格式 / Output Format

```
[对齐指令 — 仅 I2VA / FL2VA / L2VA 需要 / Alignment instruction — only for I2VA/FL2VA/L2VA]

integrated_multimodal_description: [Shot 1] 画面风格描述 + 画面内容...
[Shot 2] At MM:SS.mmm, 镜头切换...

overall_soundscape: 整体环境音描述(1-4句英文)

non_diegetic_music: 背景音乐描述(1-3句英文)
```

### 对齐指令格式 / Alignment Instruction Format

**I2VA** (首帧):
```
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.
```

**FL2VA** (首尾帧):
```
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.
```

**L2VA** (尾帧):
```
How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

### 核心字段说明 / Core Field Descriptions

1. **integrated_multimodal_description** — 综合多模态描述
   - 按时间线描述画面、动作、镜头切换、对话、字幕、剧情音效
   - 使用 `[Shot N]` 标记镜头，首镜头无时间戳，后续镜头使用 `At MM:SS.mmm,`
   - 在 `[Shot 1]` 开头声明整体风格（如 Live-action, Cinematic, 3D CG, 2D-animated 等）

2. **overall_soundscape** — 整体环境音
   - 1-4句英文总结全视频的环境音、动作音、非语言人声
   - 不重复已在 multimodal description 中的对话和剧情音乐
   - 无声音时使用 `N/A`

3. **non_diegetic_music** — 画外配乐
   - 1-3句英文描述角色听不到、仅观众能听到的背景音乐
   - 描述乐器、速度、节奏、动态变化，避免抽象情绪词汇
   - 无配乐时使用 `N/A`

---

## 镜头与运镜规范 / Shot & Camera Movement Rules

### 镜头标记 / Shot Marking

```
[Shot 1] (首镜头，无时间戳 / First shot, no timestamp)
[Shot 2] At 00:03.500, the camera cuts to... (后续镜头带时间戳)
```

使用 `cuts to`, `transitions to`, `changes to`, `switches to` 表示切镜。

### 运镜表达 / Camera Movement

运镜公式：**运镜类型 + 幅度 + 速度**，融入画面描写中：

| 类型 / Type | 说明 / Meaning |
|-------------|---------------|
| Zoom In / Zoom Out | 焦距变化（机身不动）/ Focal length change |
| Push In / Pull Out | 机身前后移动 / Camera body moves |
| Pan Left / Pan Right | 机身不动，镜头水平摇动 / Lens pivots horizontally |
| Truck Left / Truck Right | 机身水平移动 / Camera translates horizontally |
| Tilt Up / Tilt Down | 镜头垂直摇动 / Lens pivots vertically |
| Arc Shot | 围绕主体弧形移动 / Camera arcs around subject |
| Tracking Shot | 跟随移动主体 / Follow moving subject |
| Static Shot | 静止 / Camera stays still |
| POV | 主观视角 / Point of view |
| Shake Slightly / Shake Strongly | 轻微/强烈抖动 |

幅度: `with small amplitude` / `with large amplitude`（中等幅度省略）
速度: `at slow speed` / `at fast speed`（正常速度省略）

示例 / Examples:
```
The camera pushes in with small amplitude at slow speed toward her hands.
The camera pans right with large amplitude at fast speed, revealing the doorway.
```

---

## 对话与字幕规范 / Dialogue & Text Rules

### 说话人标记 / Speaker Labeling

- 使用 `(S1)`, `(S2)` 等全局稳定ID标记说话人
- 第一次出现时描述身份特征
- 对话内容放在 `<d>[语言] 内容</d>` 中

```
The young woman with a quiet voice (S1) says: <d>[English] I get off at the next station.</d>
```

### 画外音 / Voiceover

使用 `says in an off-screen voiceover`，并声明角色嘴唇闭合：
```
The man (S1) says in an off-screen voiceover: <d>[English] I still remember.</d> while his lips remain completely closed.
```

### 跨镜头对话 / Dialogue Across Cuts

使用 `<scenetrans>` 标记，声明音频连续：
```
...the speaker says <d>[English] I never thought<scenetrans>
[Shot 2] At 00:05.000, ... <scenetrans>it would end this way.</d> The dialogue continues seamlessly across the cut.
```

### 画面上可见文字 / On-Screen Text

使用英文双引号包裹，保留原文不做翻译：
```
A red neon sign reading "营业中" glows above the doorway.
```

---

## 全参考模式 / Full-Reference Mode (Ref2VA)

全参考模式输出六个章节 / Ref2VA outputs six sections:

```
subject_definitions:     — 定义所有参考内容的标签和来源 / Define reference labels
summary:                 — 一句话概述任务类型和参考关系 / Task type + reference summary
retention_analysis:      — 逐标签说明参考内容的保留程度 / Retention level per label
detailed_description:    — 按时间线详细描述画面(替代 integrated_multimodal_description)
overall_soundscape:      — 同基础模式 / Same as base mode
non_diegetic_music:      — 同基础模式 / Same as base mode
```

### 参考标签类型 / Reference Label Types

| 标签 / Label | 含义 / Meaning |
|-------------|---------------|
| `<Subject N>` | 可复用的可见内容(人物、物体、场景、服装等) / Reusable visible content |
| `<Picture N>` | 用作具体帧锚点的参考图像 / Reference image as frame anchor |
| `<Video N>` | 提供编辑源、延续起点或节奏结构的视频 / Source video reference |
| `<Audio N>` | 要复制或参考的音频信号 / Audio signal to copy or reference |

### 保留程度标记 / Retention Markers

- `fully_preserved` — 完全保留
- `partially_preserved` — 部分保留
- `attribute_transfer` — 属性迁移到其他目标
- `weak_reference` — 仅保留大致相似性
- `fully_copy` (音频) — 完整复制原音频
- `partially_copy` (音频) — 部分复制
- `reference` (音频) — 仅参考音色/节奏

---

## 风格参考 / Style Templates

### 可用于 [Shot 1] 开头声明的风格词 / Style Keywords for Shot Openings

| 风格 | 英文关键词 |
|------|-----------|
| 电影写实 | Cinematic, live-action, film look |
| 3D动画 | 3D CG, Pixar-inspired, Octane render, cartoon rendering |
| 2D动画 | 2D-animated, hand-drawn animation, cel animation |
| 定格动画 | Stop-motion, claymation, papercraft |
| 水彩风 | Watercolor style, hand-painted look |
| 复古胶片 | Vintage film, 16mm, retro look |
| 产品广告 | Product photography, commercial, clean minimal |
| 水墨风 | Ink wash painting, sumi-e style |

---

## 完整示例 / Complete Examples

### 示例1: T2VA (纯文本生视频 / Text to Video)

```
integrated_multimodal_description: [Shot 1] Live-action, cinematic, a medium-wide shot frames a baker opening the shutters of a small street bakery before sunrise. The camera pushes in with small amplitude at slow speed as the middle-aged baker with a calm, slightly raspy voice (S1) places a fresh loaf on the wooden counter and says: <d>[English] First batch of the morning.</d> [Shot 2] At 00:05.000, the camera cuts to a close-up of steam rising from the sliced bread while the baker's final words carry over from the previous shot.

overall_soundscape: Wooden shutters scrape open over a quiet street as trays clink softly inside the bakery. The doorbell rings once, followed by light footsteps and the crisp sound of bread being sliced.

non_diegetic_music: A soft acoustic-guitar pattern at a moderate tempo, joined by sparse upright-bass notes and a gentle fade at the end.
```

### 示例2: I2VA (图生视频 / Image to Video)

```
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, the young woman shown in <Picture 1> remains beside the rain-covered train window, preserving her appearance, clothing, seat position, and the carriage layout. The camera trucks right with small amplitude at slow speed as she lifts her gaze from the folded letter toward the passing city lights. Her reflection moves across the glass while the quiet, breathy young woman (S1) says: <d>[English] I get off at the next station.</d> She folds the letter along its existing crease.

overall_soundscape: The train wheels produce a steady metallic rhythm beneath a low ventilation hum. Rain ticks against the window while paper rustles softly in her hands.

non_diegetic_music: Sustained cello notes at a slow tempo with widely spaced piano tones, gradually decreasing in volume.
```

### 示例3: FL2VA (首尾帧生视频 / First-Last Frame to Video)

```
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the 8.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a rain-soaked cyclist begins in the position and framing established by Picture 1, holding a closed black umbrella beside a silver bicycle. The camera pulls out with small amplitude at slow speed as she releases the bicycle handle, raises the umbrella above her shoulder, and presses the runner upward until the canopy opens. Water rolls from the expanding fabric while she steps beneath it, rotates the handle into the final angle, and settles into the pose, spacing, and composition established by Picture 2 at the end of the shot.

overall_soundscape: Rain falls steadily on the pavement, followed by the metallic click of the umbrella runner and the soft snap of the canopy opening. Water drips from the bicycle frame as distant traffic passes.

non_diegetic_music: N/A
```

### 示例4: L2VA (尾帧生视频 / Last Frame to Video)

```
How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the 6.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a close shot begins with an intact drinking glass near the edge of a dark wooden table, while the same hand and sleeve visible in <Picture 1> approach from the right. The camera pushes in with small amplitude at slow speed as the fingertips strike the rim. The glass tips, falls, and hits the floor with a sharp impact; cracks spread through it as fragments slide outward. Toward the end, the moving pieces lose momentum and settle into the exact broken arrangement, hand position, camera angle, lighting, and final composition established by <Picture 1>.

overall_soundscape: Fingertips tap the glass before it scrapes across the tabletop, falls, and breaks with a sharp crash. Small fragments scatter and gradually stop sliding across the floor.

non_diegetic_music: A low electronic pulse at a slow tempo, ending immediately after the glass breaks.
```

### 示例5: Ref2VA (全参考模式 / Full Reference Mode)

```
subject_definitions:
<Subject 1> is the coffee-shop environment in <Picture 1>, featuring an exposed brick wall, an orange tufted sofa with patterned pillows, a neon sign, and a wooden coffee table.
<Subject 2> is the fluffy white Samoyed in <Picture 2>, <Picture 3>, and <Picture 4>, with thick white fur, pointed ears, a dark nose, and a curved tail.
<Subject 3> is the young blonde woman in <Video 1>, with long blonde hair and a light-pink button-down shirt with rolled-up sleeves.
<Subject 4> is the young man in <Video 2>, with short wavy brown hair and a dark-grey hoodie with drawstrings.
<Audio 1> is the voice-timbre reference for <Subject 3> (S1), containing a spoken English vocal layer.

summary:
[reference generation + audio reference] The target video shows <Subject 3> eating a cookie in <Subject 1>. <Subject 4> enters with <Subject 2>, which lunges toward the cookie. The three-shot exchange uses <Audio 1> as the voice-timbre reference for <Subject 3> and ends with a canned audience laugh.

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table are retained.
<Subject 2> (appears in [Shot 1], [Shot 2]): fully_preserved - the Samoyed's thick white fur, pointed ears, dark nose, and curved tail are retained.
<Subject 3> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the blonde woman's identity, long hair, and light-pink shirt are retained.
<Subject 4> (appears in [Shot 1], [Shot 2]): fully_preserved - the young man's short wavy brown hair and dark-grey hoodie are retained.
<Audio 1>: reference - its vocal timbre guides the dialogue delivery of <Subject 3> without copying the original signal.

detailed_description:
The target video uses a realistic multi-camera sitcom style with warm indoor lighting.
[Shot 1] A medium shot establishes <Subject 1>, the coffee shop with its exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table. <Subject 3> (S1), the young woman with long blonde hair and a light-pink button-down shirt with rolled-up sleeves, sits on the sofa holding a chocolate-chip cookie. From the left, <Subject 4>, the young man with short wavy brown hair and a dark-grey hoodie with drawstrings, enters holding the leash of <Subject 2>, the thick-furred white Samoyed with pointed ears, a dark nose, and a curved tail. The dog lunges toward the cookie and pulls the leash taut. <Subject 3> (S1) jerks her hand back and, using the clear youthful voice timbre referenced from <Audio 1>, exclaims with light annoyance, <d>[English] Hey! Watch your dog!</d> She closes her lips and guards the cookie while <Subject 4> pulls the dog back.
[Shot 2] At 00:03.000, the shot cuts to a close-up of <Subject 4> (S2), the young man in the dark-grey hoodie from Shot 1, sitting beside <Subject 3> on the sofa and holding <Subject 2> securely in his arms. <Subject 4> (S2) says in a casual young male voice with a playful tone, <d>[English] He just likes cookies more than me.</d> He closes his mouth into an apologetic smile and strokes the dog's thick white fur.
[Shot 3] At 00:05.000, the shot cuts to a close-up of <Subject 3> (S1), the blonde woman in the light-pink shirt from Shot 1. Her annoyance softens as she looks toward the Samoyed. <Subject 3> (S1) replies in the same clear youthful voice referenced from <Audio 1> with an amused cadence, <d>[English] Well, he has good taste at least.</d> She smiles and raises the cookie in a small toast-like gesture. A classic canned audience laugh begins immediately after the line and continues through the final frame.

overall_soundscape:
Soft indoor coffee-shop room tone continues throughout the scene.

non_diegetic_music:
N/A
```

---

## 你的任务 / Your Task

根据用户的输入（文本描述 + 可选的图片/视频/音频参考），生成一个符合上述规范的
MiniMax H3 视频生成提示词。

步骤 / Steps:
1. **识别模式 / Identify Mode**: 根据用户提供的输入类型确定使用哪种模式(T2VA/I2VA/FL2VA/L2VA/Ref2VA)
2. **分析需求 / Analyze Requirements**: 提取用户想要的画面内容、风格、时长、运镜等需求
3. **编写提示词 / Write Prompt**: 严格按照本指南的格式编写完整的提示词
4. **输出完整结果 / Output Complete Result**: 直接输出可直接使用的提示词文本

详细参考文件 / Detailed reference files:
- `references/base-en.txt` — 基础模式(T2VA/I2VA/FL2VA/L2VA)完整指南
- `references/ref-en.txt` — 全参考模式(Ref2VA)完整指南
