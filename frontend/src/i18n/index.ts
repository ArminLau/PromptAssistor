/**
 * 轻量国际化模块 / Lightweight i18n module.
 *
 * 提供 useI18n() hook 与 translate() 翻译函数。语言状态保存在 Zustand store 中
 * （并持久化到 localStorage 与后端 config.json 的 ui.language 字段）。
 * 翻译文案以键值对形式存于 src/locales/zh-CN.json 与 en-US.json。
 * / Provides the useI18n() hook and translate() function. Language state lives in
 * the Zustand store (persisted to localStorage and the backend `ui.language`
 * field). Translations are keyed in src/locales/zh-CN.json and en-US.json.
 */

import { useAppStore, type Language } from '../stores/appStore'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

export type { Language }

const dictionaries: Record<Language, Record<string, unknown>> = {
  zh: zhCN as unknown as Record<string, unknown>,
  en: enUS as unknown as Record<string, unknown>,
}

/**
 * 按点分 key 进行嵌套查找 / Resolve a dotted key against the dictionary.
 *
 * 若 key 缺失或对应值不是字符串，则原样返回 key，便于发现漏翻译的条目。
 * / Returns the key unchanged if missing or not a string, to surface untranslated entries.
 */
export function translate(lang: Language, key: string): string {
  const dict = dictionaries[lang]
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
  return typeof value === 'string' ? value : key
}

/**
 * 当前语言的翻译 hook / Translation hook bound to the current language.
 *
 * 用法 / usage: `const { t, language } = useI18n()`，然后 `t('common.save')`。
 */
export function useI18n() {
  const language = useAppStore((s) => s.language)
  const t = (key: string) => translate(language, key)
  return { t, language }
}

/**
 * 根据语言二选一 / Pick a string by language.
 *
 * 用于需要同时给出中英文、又不想拆分为翻译 key 的场景（如选项标签）。
 * / For cases where both languages are given inline (e.g. option labels).
 */
export function pick(lang: Language, zh: string, en: string): string {
  return lang === 'zh' ? zh : en
}
