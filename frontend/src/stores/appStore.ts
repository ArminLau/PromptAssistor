/**
 * Global application state store using Zustand.
 * / 全局应用状态存储（Zustand）。
 */

import { create } from 'zustand'
import { configApi } from '../services/api'

// 界面语言 / UI language
export type Language = 'zh' | 'en'

// localStorage 持久化键 / localStorage persistence key
const LANGUAGE_STORAGE_KEY = 'prompt-assistor-language'

// 从 localStorage 读取初始语言，缺省为中文 / Read initial language from localStorage, default zh
function readInitialLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (value === 'zh' || value === 'en') return value
  } catch {
    // localStorage 不可用时静默回退 / silently fall back when localStorage unavailable
  }
  return 'zh'
}

interface AppState {
  // Backend connection
  backendReady: boolean
  setBackendReady: (ready: boolean) => void

  // Active model/skill per feature
  activeModels: Record<string, string>
  setActiveModel: (featureId: string, skillName: string) => void

  // UI state
  loading: boolean
  setLoading: (loading: boolean) => void

  // 界面语言 / UI language
  language: Language
  setLanguage: (language: Language) => void
}

export const useAppStore = create<AppState>((set) => ({
  backendReady: false,
  setBackendReady: (ready) => set({ backendReady: ready }),

  activeModels: {},
  setActiveModel: (featureId, skillName) =>
    set((state) => ({
      activeModels: { ...state.activeModels, [featureId]: skillName },
    })),

  loading: false,
  setLoading: (loading) => set({ loading }),

  language: readInitialLanguage(),
  setLanguage: (language) => {
    set({ language })
    // 持久化到 localStorage / persist to localStorage
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // 忽略 localStorage 写入失败 / ignore localStorage write failures
    }
    // 同步到后端 config.json 的 ui.language 字段（尽力而为，失败不影响界面）
    // Sync to backend config.json `ui.language` field (best-effort; failures are non-fatal)
    configApi
      .update({ 'ui.language': language === 'zh' ? 'zh_CN' : 'en_US' })
      .catch(() => {
        // 后端未就绪或网络失败时忽略 / ignore when backend not ready or network fails
      })
  },
}))
