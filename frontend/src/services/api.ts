/**
 * API service layer for PromptAssistor.
 *
 * Provides typed methods for all backend API endpoints.
 */

import axios, { AxiosInstance } from 'axios'

export const API_BASE_URL = 'http://127.0.0.1:18720/api/v1'

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

// 分段结果项 / multi-segment result item
export interface SegmentResult {
  index: number      // 分段序号（从 1 起）/ segment index (1-based)
  duration: number   // 该段视频时长（秒）/ this segment's video duration (seconds)
  content: string    // 该段完整提示词 / this segment's full prompt
}

export interface GenerateResult {
  success: boolean
  result?: string
  segments?: SegmentResult[]  // 多段结果（仅 minimax_h3 分段时返回）/ multi-segment results
  error?: string
  model_name?: string
  tokens_used?: number
}

// 反推逐图结果项 / per-image reverse result item
export interface ReverseResultItem {
  filename: string
  result?: string
  error?: string
  model_name?: string
  tokens_used?: number
}

// ─── 数据集 / Dataset types ────────────────────────────────────────────────

export interface DatasetInfo {
  name: string
  item_count: number
  cover_filename: string | null
}

export interface DatasetConfig {
  reverse_target: string
  target_length: number
  reverse_style: string
  output_language: string
  reverse_requirement: string
}

export interface DatasetItem {
  filename: string
  prompt_text: string | null
}

export interface DatasetDetail {
  name: string
  config: DatasetConfig
  total: number
  page: number
  page_size: number
  items: DatasetItem[]
}

// 批量打标流式结果项 / batch-tag streaming result item
export interface TagResultItem {
  filename: string
  result?: string
  error?: string
  model_name?: string
}

// ─── 参考标签库 / Reference tag library types ──────────────────────────────

export interface LabelTag {
  name: string
  content: string
  note: string
  has_preview: boolean
}

/** 标签树节点（任意深度分类，标签为叶子）/ Label tree node (arbitrary-depth category, tags are leaves) */
export interface LabelNode {
  name: string       // 分类名 / category name
  path: string       // 完整相对路径，如 "自然语言/人物/发型" / full relative path
  children: LabelNode[]
  tags: LabelTag[]
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
  /**
   * 流式反推 / Streaming reverse.
   *
   * 后端以 NDJSON 逐图推送结果；每张图完成即调用一次 onResult，
   * 前端可增量渲染，无需等全部图片反推完成。
   * / The backend streams per-image NDJSON; onResult fires once per completed
   * image so the frontend can render incrementally.
   */
  generateStream: async (
    formData: FormData,
    onResult: (item: ReverseResultItem) => void,
  ): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/reverse`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok || !response.body) {
      throw new Error(`Reverse request failed / 反推请求失败: HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        onResult(JSON.parse(trimmed) as ReverseResultItem)
      } catch (e) {
        console.warn('Failed to parse reverse stream line / 解析流式行失败:', trimmed, e)
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(handleLine)
    }
    // 处理缓冲区中残留的最后一行 / flush the remaining buffered line
    if (buffer.trim()) handleLine(buffer)
  },
}

export const expandApi = {
  generate: (data: {
    expansion_type?: string  // 扩写类型: minimax_h3 | natural_language | danbooru
    skill_name?: string      // 目标 skill（为空时由 expansion_type 推导）
    model_type?: string      // 模型类型: krea2 | z-image | flux | qwen-image | anima | sdxl
    short_prompt: string
    target_duration?: number
    segment_duration?: number | null  // 分段时长(秒)，null=不拆分 / segment duration (seconds)
    generation_mode?: string
    visual_style?: string
    expansion_style?: string
    target_length?: number   // 扩写长度(字符) / target length in characters
    output_language?: string // 输出语言 ("zh"/"en") / output language
    extra_context?: string
    images?: string[]  // base64 data URLs / 参考图片的base64数据URL
  }) =>
    // timeout: 0 = 不设超时（模型响应可能很慢，不做限制）/ no timeout (model responses may be slow)
    api.post<GenerateResult>('/expand', data, { timeout: 0 }),
}

// 读取 NDJSON 流并逐行回调 / Read an NDJSON stream and call onLine per line
async function fetchNdjsonStream(
  url: string,
  init: RequestInit,
  onLine: (item: unknown) => void,
): Promise<void> {
  const response = await fetch(url, init)
  if (!response.ok || !response.body) {
    throw new Error(`Request failed / 请求失败: HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      onLine(JSON.parse(trimmed))
    } catch (e) {
      console.warn('Failed to parse NDJSON line / 解析流式行失败:', trimmed, e)
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  }
  if (buffer.trim()) handleLine(buffer)
}

// 批量打标流式请求 / Batch-tag streaming request helper
async function postTagStream(
  name: string,
  body: { filenames?: string[]; all?: boolean },
  onResult: (item: TagResultItem) => void,
): Promise<void> {
  await fetchNdjsonStream(
    `${API_BASE_URL}/batch/datasets/${encodeURIComponent(name)}/tag`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    (item) => onResult(item as TagResultItem),
  )
}

export const batchApi = {
  // ─── 数据集 CRUD / dataset CRUD ────────────────────────────────
  listDatasets: (search?: string) =>
    api.get<{ success: boolean; datasets: DatasetInfo[] }>('/batch/datasets', {
      params: { search: search || undefined },
    }),
  createDataset: (name: string) =>
    api.post<{ success: boolean; dataset: DatasetConfig }>('/batch/datasets', { name }),
  renameDataset: (name: string, newName: string) =>
    api.put<{ success: boolean }>(
      `/batch/datasets/${encodeURIComponent(name)}`,
      { new_name: newName },
    ),
  deleteDataset: (name: string) =>
    api.delete<{ success: boolean }>(`/batch/datasets/${encodeURIComponent(name)}`),

  // ─── 数据集详情与配置 / detail & config ────────────────────────
  getDataset: (name: string, page = 1, pageSize = 12) =>
    api.get<{ success: boolean } & DatasetDetail>(
      `/batch/datasets/${encodeURIComponent(name)}`,
      { params: { page, page_size: pageSize } },
    ),
  updateConfig: (name: string, config: Partial<DatasetConfig>) =>
    api.put<{ success: boolean; name: string; config: DatasetConfig }>(
      `/batch/datasets/${encodeURIComponent(name)}/config`,
      config,
    ),

  // ─── 素材增删 / item add & delete ─────────────────────────────
  addItems: (name: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return api.post<{ success: boolean; added: string[]; duplicates: string[] }>(
      `/batch/datasets/${encodeURIComponent(name)}/items`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000 },
    )
  },
  deleteItems: (name: string, filenames: string[]) =>
    api.delete<{ success: boolean; deleted: string[]; failed: string[] }>(
      `/batch/datasets/${encodeURIComponent(name)}/items`,
      { data: { filenames } },
    ),

  // ─── 打标 / tagging ───────────────────────────────────────────
  tagItem: (name: string, filename: string) =>
    api.post<{ success: boolean; filename: string; prompt_text: string; model_name?: string }>(
      `/batch/datasets/${encodeURIComponent(name)}/items/${encodeURIComponent(filename)}/tag`,
      null,
      { timeout: 300000 },
    ),
  /** 流式批量打标选中素材 / Stream batch-tag of selected items */
  tagItems: async (
    name: string,
    filenames: string[],
    onResult: (item: TagResultItem) => void,
  ): Promise<void> => postTagStream(name, { filenames }, onResult),
  /** 流式批量打标数据集全部素材 / Stream batch-tag of all items in a dataset */
  tagAllItems: async (
    name: string,
    onResult: (item: TagResultItem) => void,
  ): Promise<void> => postTagStream(name, { all: true }, onResult),

  // ─── 图片 URL / image URL ─────────────────────────────────────
  imageUrl: (name: string, filename: string) =>
    `${API_BASE_URL}/batch/datasets/${encodeURIComponent(name)}/files/${encodeURIComponent(filename)}`,
}

// ─── Prompt Generation API / 提示词生成 API ────────────────────────────────

export const generateApi = {
  generate: (data: {
    target: string
    target_length?: number
    style?: string
    output_language?: string
    requirement?: string
    tags?: { name: string; content: string }[]
  }) =>
    // timeout: 0 = 不设超时（模型响应可能很慢，不做限制）/ no timeout (model responses may be slow)
    api.post<GenerateResult>('/generate', data, { timeout: 0 }),
}

// ─── Labels API / 参考标签库 API ───────────────────────────────────────────

export const labelsApi = {
  /** 获取标签库完整树 / Fetch the full label library tree */
  tree: () => api.get<{ success: boolean; tree: LabelNode[] }>('/labels/tree'),

  createCategory: (parentPath: string, name: string) =>
    api.post<{ success: boolean }>('/labels/categories', { parent_path: parentPath, name }),
  renameCategory: (path: string, newName: string) =>
    api.put<{ success: boolean }>('/labels/categories', { path, new_name: newName }),
  deleteCategory: (path: string) =>
    api.delete<{ success: boolean }>('/labels/categories', { params: { path } }),

  createTag: (data: { path: string; name: string; content: string; note: string }) =>
    api.post<{ success: boolean; tag: LabelTag }>('/labels/tags', data),
  updateTag: (
    path: string,
    name: string,
    data: { name?: string; content?: string; note?: string },
  ) =>
    api.put<{ success: boolean; tag: LabelTag }>('/labels/tags', {
      path,
      name,
      new_name: data.name,
      content: data.content,
      note: data.note,
    }),
  deleteTag: (path: string, name: string) =>
    api.delete<{ success: boolean }>('/labels/tags', { params: { path, name } }),

  /** 预览图 URL / preview image URL */
  previewUrl: (path: string, name: string) =>
    `${API_BASE_URL}/labels/files?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`,
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
