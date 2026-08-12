/**
 * Shared TypeScript type definitions for PromptAssistor.
 */

// Provider types
export type ProviderType = 'local' | 'online' | 'ollama'

export interface ProviderInfo {
  active: {
    type: ProviderType
    model_name: string
  } | null
  available: ProviderType[]
}

// Skill types
export interface SkillInfo {
  name: string
  display_name: string
  type: 'image_generation' | 'video_generation'
  version: string
  author: string
  description: string
  tags: string[]
  has_override: boolean
  source_path?: string
}

export interface SkillDetail extends SkillInfo {
  content?: string
  override_content?: string
  override_description?: string
}

// Prompt library types
export interface PromptItem {
  id: number
  title: string
  content: string
  model_name: string
  category: string
  tags: string[]
  is_favorite: boolean
  source_type: 'reverse' | 'expand' | 'manual' | 'batch'
  source_media: string[]
  notes: string
  created_at: string
  updated_at: string
}

// Generation result
export interface GenerateResult {
  success: boolean
  result?: string
  error?: string
  model_name?: string
  tokens_used?: number
}

// Batch task
export interface BatchTaskStatus {
  success: boolean
  task_id?: string
  status?: 'processing' | 'completed' | 'error'
  total?: number
  completed?: number
  results?: Array<{ text: string; model: string }>
  error?: string
}

// App configuration
export interface AppConfig {
  active_provider: ProviderType
  port: number
  providers: {
    local: LocalProviderConfig
    online: OnlineProviderConfig
    ollama: OllamaProviderConfig
  }
  ui: {
    language: string
    theme: 'light' | 'dark' | 'auto'
  }
  features: {
    reverse: { active_model: string }
    expand: { active_model: string }
    batch: { active_model: string }
  }
}

export interface LocalProviderConfig {
  model_path: string
  mmproj_path: string
  n_ctx: number
  n_threads: number
  gpu_layers: number
  temperature: number
  top_p: number
}

export interface OnlineProviderConfig {
  provider: string
  api_key: string
  api_base: string
  model_name: string
  temperature: number
  max_tokens: number
}

export interface OllamaProviderConfig {
  host: string
  model_name: string
  temperature: number
}
