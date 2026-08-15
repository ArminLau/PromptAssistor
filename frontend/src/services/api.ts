/**
 * API service layer for PromptAssistor.
 *
 * Provides typed methods for all backend API endpoints.
 */

import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = 'http://127.0.0.1:18720/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes for long generations
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────

export interface SkillInfo {
  name: string
  display_name: string
  type: string
  version: string
  author: string
  description: string
  tags: string[]
  has_override: boolean
}

export interface PromptItem {
  id: number
  title: string
  content: string
  model_name: string
  category: string
  tags: string[]
  is_favorite: boolean
  source_type: string
  created_at: string
  updated_at: string
}

export interface GenerateResult {
  success: boolean
  result?: string
  error?: string
  model_name?: string
  tokens_used?: number
}

// ─── Model API ────────────────────────────────────────────────────────────

export const modelApi = {
  listModels: () => api.get('/models'),
  getActive: () => api.get('/models/active'),
  switchProvider: (providerType: string) => api.put('/models/active', null, { params: { provider_type: providerType } }),
  testProvider: (providerType: string) => api.post('/models/test', null, { params: { provider_type: providerType } }),
}

// ─── Feature APIs ─────────────────────────────────────────────────────────

export const reverseApi = {
  generate: (formData: FormData) =>
    api.post<GenerateResult>('/reverse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }),
}

export const expandApi = {
  generate: (data: {
    expansion_type?: string  // 扩写类型: minimax_h3 | natural_language | danbooru
    skill_name?: string      // 目标 skill（为空时由 expansion_type 推导）
    model_type?: string      // 模型类型: krea2 | z-image | flux | qwen-image | anima | sdxl
    short_prompt: string
    target_duration?: number
    generation_mode?: string
    visual_style?: string
    expansion_style?: string
    target_length?: number   // 扩写长度(字符) / target length in characters
    extra_context?: string
    images?: string[]  // base64 data URLs / 参考图片的base64数据URL
  }) =>
    api.post<GenerateResult>('/expand', data, { timeout: 180000 }),
}

export const batchApi = {
  tag: (formData: FormData) =>
    api.post('/batch/tag', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10 minutes for batches
    }),
  getStatus: (taskId: string) => api.get(`/batch/status/${taskId}`),
}

// ─── Library API ──────────────────────────────────────────────────────────

export const libraryApi = {
  list: (params?: Record<string, any>) => api.get('/library', { params }),
  get: (id: number) => api.get(`/library/${id}`),
  create: (data: Partial<PromptItem>) => api.post('/library', data),
  update: (id: number, data: Partial<PromptItem>) => api.put(`/library/${id}`, data),
  delete: (id: number) => api.delete(`/library/${id}`),
  getTags: () => api.get('/library/search/tags'),
  getCategories: () => api.get('/library/search/categories'),
}

// ─── Skill API ────────────────────────────────────────────────────────────

export const skillApi = {
  list: () => api.get('/skills'),
  get: (name: string) => api.get(`/skills/${name}`),
  saveOverride: (name: string, data: { skill_name: string; override_content: string; description: string }) =>
    api.put(`/skills/${name}`, data),
  deleteOverride: (name: string) => api.delete(`/skills/${name}`),
}

// ─── Config API ───────────────────────────────────────────────────────────

export const configApi = {
  get: () => api.get('/config'),
  update: (data: Record<string, any>) => api.put('/config', data),
}

// ─── System API / 系统API ────────────────────────────────────────────────

export const systemApi = {
  scanModels: () => api.get('/system/models/scan'),
  /** 打开系统原生文件夹选择对话框 / Open native folder picker dialog */
  selectFolder: () => api.post<{ success: boolean; path?: string; message?: string }>('/system/select-folder'),
}

export default api
