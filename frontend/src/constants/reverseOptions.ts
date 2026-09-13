/**
 * 反推相关选项常量 / Reverse-engineering option constants.
 *
 * Shared by the reverse page (F1) and the batch-tagging dataset page (F3)
 * so the target / length / style / language options stay in sync.
 * 选项标签按语言二选一返回，由调用方传入当前界面语言。
 * / Shared by F1 (reverse) and F3 (batch-tagging) so the target/length/style/
 * language options stay in sync. Option labels are localized by language.
 */

import { pick, type Language } from '../i18n'

// ─── 模型品牌名（无需翻译）/ Model brand names (no translation needed) ──────

export const NATURAL_MODELS = [
  { value: 'krea2', label: 'Krea 2' },
  { value: 'z-image', label: 'Z-Image' },
  { value: 'flux', label: 'FLUX.1' },
  { value: 'qwen-image', label: 'Qwen-Image' },
]

export const DANBOORU_MODELS = [
  { value: 'anima', label: 'Anima' },
  { value: 'sdxl', label: 'SDXL' },
]

// ─── 反推目标 / Reverse targets ──────────────────────────────────────────

// 下拉分组选项 / grouped select options（value 编码为 `skill:model_type` 或 `reference`）
export function getReverseTargetOptions(lang: Language) {
  return [
    {
      label: pick(lang, '完全参考', 'Reference Only'),
      options: [
        { value: 'reference', label: pick(lang, '完全参考反推需求描述', 'Fully follow requirement') },
      ],
    },
    {
      label: pick(lang, '自然语言', 'Natural Language'),
      options: NATURAL_MODELS.map((m) => ({
        value: `natural_prompt:${m.value}`,
        label: pick(lang, `自然语言 ${m.label}`, `Natural Language ${m.label}`),
      })),
    },
    {
      label: pick(lang, 'Danbooru 标签', 'Danbooru Tags'),
      options: DANBOORU_MODELS.map((m) => ({
        value: `danbooru_prompt:${m.value}`,
        label: `Danbooru ${m.label}`,
      })),
    },
  ]
}

// ─── 反推风格 / Reverse styles ───────────────────────────────────────────

export interface ReverseStyleOption {
  value: string
  label: string
  desc: string
}

export function getReverseStyles(lang: Language): ReverseStyleOption[] {
  return [
    {
      value: 'five_point',
      label: pick(lang, '自然语言·五点结构式', 'Natural Language · Five-Point'),
      desc: pick(
        lang,
        '单段连贯自然语言，按五点结构(构图、主体、环境、文字、风格)极致还原画面，适用于Flux、MJ等自然语言提示词模型。',
        'A single coherent natural-language paragraph in five-point structure (composition, subject, environment, text, style); suited to natural-language prompt models like Flux, MJ.',
      ),
    },
    {
      value: 'multi_paragraph',
      label: pick(lang, '自然语言·多段长描述', 'Natural Language · Multi-Paragraph'),
      desc: pick(
        lang,
        '2-5段自然语言长描述，无Markdown结构，支持角色名。2~5段自然语言，无Markdown小标题。',
        '2-5 paragraphs of natural-language long description, no Markdown structure, supports character names.',
      ),
    },
    {
      value: 'short',
      label: pick(lang, '自然语言·短描述', 'Natural Language · Short'),
      desc: pick(
        lang,
        '简短扼要，覆盖主要对象与细节，无冗长修辞。短段落自然语言描述。',
        'Brief and concise, covering main subjects and details, no lengthy rhetoric.',
      ),
    },
  ]
}

// ─── 输出语言 / Output languages ─────────────────────────────────────────

export function getOutputLanguages(lang: Language) {
  return [
    { value: 'zh', label: pick(lang, '中文', 'Chinese') },
    { value: 'en', label: pick(lang, '英文', 'English') },
  ]
}

// ─── 反推配置类型与默认值 / Reverse config type & default ─────────────────

export interface ReverseConfig {
  reverseTarget: string
  targetLength: number | null
  reverseStyle: string
  outputLanguage: string
  requirement: string
}

export const DEFAULT_REVERSE_CONFIG: ReverseConfig = {
  reverseTarget: 'natural_prompt:krea2',
  targetLength: 500,
  reverseStyle: 'five_point',
  outputLanguage: 'zh',
  requirement: '',
}

// 解析反推目标值 → { skill, modelType } / parse target value
export function parseTarget(val: string): { skill: string; modelType: string } {
  if (!val || val === 'reference') return { skill: '', modelType: '' }
  const idx = val.indexOf(':')
  if (idx < 0) return { skill: val, modelType: '' }
  return { skill: val.slice(0, idx), modelType: val.slice(idx + 1) }
}
