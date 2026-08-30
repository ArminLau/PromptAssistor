/**
 * F2: 提示词扩写 / Prompt Expansion
 *
 * Minimax-H3 specific interactive prompt builder.
 * / Minimax-H3 专用交互式提示词构建器。
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Card, Button, Input, InputNumber, Upload, Typography, message,
  Space, Tag, Row, Col, Tooltip, Image as AntImage, Select,
} from 'antd'
import {
  ThunderboltOutlined, InboxOutlined, PictureOutlined,
  VideoCameraOutlined, AudioOutlined, CopyOutlined,
  DeleteOutlined, PaperClipOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { expandApi, configApi, type SegmentResult } from '../services/api'
import { useI18n, pick } from '../i18n'

const { TextArea } = Input
const { Title, Text } = Typography
const { Dragger } = Upload

// ─── Types / 类型定义 ───────────────────────────────────────────────────

interface MaterialRef {
  id: string         // e.g., <Picture 1>, <Video 2>, <Audio 1> / 素材标签
  fileName: string   // original file name / 原始文件名
  type: 'image' | 'video' | 'audio'
  file: UploadFile
  previewUrl: string // object URL for thumbnail / 缩略图的 Object URL
}

// ─── Helpers / 辅助函数 ─────────────────────────────────────────────────

let _tagCounter = { image: 0, video: 0, audio: 0 }

function resetTagCounter() {
  _tagCounter = { image: 0, video: 0, audio: 0 }
}

function getNextTag(mediaType: string): string {
  const map: Record<string, { key: string; label: string }> = {
    'image': { key: 'image', label: 'Picture' },
    'video': { key: 'video', label: 'Video' },
    'audio': { key: 'audio', label: 'Audio' },
  }
  const entry = map[mediaType] || { key: 'file', label: 'File' }
  _tagCounter[entry.key as keyof typeof _tagCounter]++
  const num = _tagCounter[entry.key as keyof typeof _tagCounter]
  return `<${entry.label} ${num}>`
}

function guessMediaType(file: UploadFile): 'image' | 'video' | 'audio' {
  const name = file.name.toLowerCase()
  const type = file.type || ''
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif|tiff)$/i.test(name)) return 'image'
  if (type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(name)) return 'video'
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name)) return 'audio'
  return 'image'
}

// 将文件读取为 base64 data URL / Read a file as a base64 data URL
function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// ─── Thumbnail sub-component / 缩略图子组件 ────────────────────────────

const MaterialThumb: React.FC<{ material: MaterialRef; size?: number }> = ({ material, size = 64 }) => {
  if (material.type === 'image' && material.previewUrl) {
    return (
      <AntImage
        src={material.previewUrl}
        width={size}
        height={size}
        style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #e8e8e8' }}
        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMzIiIHk9IjMyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxMiI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=="
      />
    )
  }

  if (material.type === 'video') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, border: '1px solid #e8e8e8',
        background: '#1a1a2e', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden',
      }}>
        <VideoCameraOutlined style={{ fontSize: size * 0.35, color: '#7c3aed' }} />
        <Text style={{ fontSize: size * 0.14, color: '#aaa', maxWidth: size - 6, textAlign: 'center', lineHeight: 1.1 }}
          ellipsis={{ tooltip: material.fileName }}>
          {material.fileName}
        </Text>
      </div>
    )
  }

  // Audio / 音频
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, border: '1px solid #e8e8e8',
      background: '#1c1917', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden',
    }}>
      <AudioOutlined style={{ fontSize: size * 0.35, color: '#f59e0b' }} />
      <Text style={{ fontSize: size * 0.14, color: '#aaa', maxWidth: size - 6, textAlign: 'center', lineHeight: 1.1 }}
        ellipsis={{ tooltip: material.fileName }}>
        {material.fileName}
      </Text>
    </div>
  )
}

// ─── H3 Generation Modes / H3生成模式 ──────────────────────────────────

interface ModeOption {
  value: string
  label: string      // 中文 / Chinese
  labelEn: string    // 英文 / English
  desc: string
  descEn: string
  inputs: string
  inputsEn: string
}

const GENERATION_MODES: ModeOption[] = [
  { value: 'T2VA', label: 'T2VA — 文生视频', labelEn: 'T2VA — Text to Video', desc: '纯文本构建完整视听时间线', descEn: 'Build full audiovisual timeline from text', inputs: '仅文本', inputsEn: 'Text only' },
  { value: 'I2VA', label: 'I2VA — 图生视频', labelEn: 'I2VA — Image to Video', desc: '从首帧图片出发向前发展', descEn: 'Start from first frame and develop forward', inputs: '文本 + 1张首帧图', inputsEn: 'Text + 1 first frame image' },
  { value: 'FL2VA', label: 'FL2VA — 首尾帧生视频', labelEn: 'FL2VA — First-Last Frame', desc: '描述首帧到尾帧的连续变化路径', descEn: 'Describe path between first and last frames', inputs: '文本 + 首帧图 + 尾帧图', inputsEn: 'Text + first + last frame' },
  { value: 'L2VA', label: 'L2VA — 尾帧生视频', labelEn: 'L2VA — Last Frame to Video', desc: '推断开头并逐渐收敛到尾帧', descEn: 'Infer opening and converge to last frame', inputs: '文本 + 1张尾帧图', inputsEn: 'Text + 1 last frame image' },
  { value: 'Ref2VA', label: 'Ref2VA — 全参考生视频', labelEn: 'Ref2VA — Full Reference', desc: '多图+视频+音频全模态参考', descEn: 'Multi-modal reference generation', inputs: '文本+图(≤9)+视频(≤3)+音频(≤3)', inputsEn: 'Text+Img(≤9)+Vid(≤3)+Aud(≤3)' },
]

// ─── Visual Style Options / 视觉风格选项 ───────────────────────────────

interface StyleOption {
  value: string
  label: string      // 中文 / Chinese
  labelEn: string    // 英文 / English
  category: string   // 分类（中文）/ Category (Chinese)
  categoryEn: string // 分类（英文）/ Category (English)
  enLabel: string    // 英文提示词文本 / English prompt text
}

const VISUAL_STYLES: StyleOption[] = [
  // 写实类 / Realistic
  { value: 'Cinematic, live-action, film look', label: '电影写实', labelEn: 'Cinematic Live-Action', category: '写实', categoryEn: 'Realistic', enLabel: 'Cinematic, live-action, film look' },
  { value: 'Vintage film, 16mm, retro look', label: '复古胶片', labelEn: 'Vintage Film', category: '写实', categoryEn: 'Realistic', enLabel: 'Vintage film, 16mm, retro look' },
  { value: 'Documentary, handheld, natural light', label: '纪录片风格', labelEn: 'Documentary', category: '写实', categoryEn: 'Realistic', enLabel: 'Documentary, handheld, natural light' },

  // 3D类 / 3D
  { value: '3D CG, Pixar-inspired, Octane render, cartoon rendering', label: '3D动画(皮克斯风)', labelEn: '3D CG Pixar-style', category: '3D / CG', categoryEn: '3D / CG', enLabel: '3D CG, Pixar-inspired, Octane render, cartoon rendering' },
  { value: '3D CG, photorealistic render, Unreal Engine 5 quality', label: '3D写实渲染', labelEn: '3D Photorealistic', category: '3D / CG', categoryEn: '3D / CG', enLabel: '3D CG, photorealistic render, unreal engine quality' },
  { value: '3D CG, minimalist product render, clean studio lighting', label: '3D产品渲染', labelEn: '3D Product Render', category: '3D / CG', categoryEn: '3D / CG', enLabel: '3D CG, minimalist product render, clean studio lighting' },

  // 2D类 / 2D
  { value: '2D-animated, hand-drawn animation, cel animation', label: '2D手绘动画', labelEn: '2D Hand-Drawn', category: '2D / 手绘', categoryEn: '2D / Hand-Drawn', enLabel: '2D-animated, hand-drawn animation, cel animation' },
  { value: 'Anime style, Japanese animation, vibrant colors', label: '日式动画', labelEn: 'Anime Style', category: '2D / 手绘', categoryEn: '2D / Hand-Drawn', enLabel: 'Anime style, Japanese animation, vibrant colors' },
  { value: 'Watercolor style, hand-painted look, soft brushstrokes', label: '水彩手绘', labelEn: 'Watercolor', category: '2D / 手绘', categoryEn: '2D / Hand-Drawn', enLabel: 'Watercolor style, hand-painted look, soft brushstrokes' },
  { value: 'Ink wash painting, sumi-e style, traditional Chinese art', label: '水墨画', labelEn: 'Ink Wash Painting', category: '2D / 手绘', categoryEn: '2D / Hand-Drawn', enLabel: 'Ink wash painting, sumi-e style, traditional Chinese art' },

  // 定格动画类 / Stop-Motion
  { value: 'Stop-motion, claymation, textured handmade feel', label: '黏土定格', labelEn: 'Claymation', category: '定格', categoryEn: 'Stop-Motion', enLabel: 'Stop-motion, claymation, textured handmade feel' },
  { value: 'Papercraft stop-motion, layered diorama, cut-paper style', label: '纸艺定格', labelEn: 'Papercraft Stop-Motion', category: '定格', categoryEn: 'Stop-Motion', enLabel: 'Papercraft stop-motion, layered diorama, cut-paper style' },
  { value: 'Paper collage, mixed media, tactile halftone texture', label: '拼贴画风', labelEn: 'Paper Collage', category: '定格', categoryEn: 'Stop-Motion', enLabel: 'Paper collage, mixed media, tactile halftone texture' },

  // 特殊效果类 / Special Effects
  { value: 'Hand-drawn animation overlaying live-action, rough glowing lines', label: '手绘叠加实拍', labelEn: 'Hand-Drawn on Live-Action', category: '特效', categoryEn: 'Effects', enLabel: 'Hand-drawn animation overlaying live-action, rough glowing lines' },
  { value: 'Product photography, commercial, clean minimal, Scandinavian design', label: '极简产品广告', labelEn: 'Minimalist Product', category: '商业', categoryEn: 'Commercial', enLabel: 'Product photography, commercial, clean minimal' },
  { value: 'Cyberpunk, neon lights, rain-soaked streets, high contrast', label: '赛博朋克', labelEn: 'Cyberpunk', category: '特效', categoryEn: 'Effects', enLabel: 'Cyberpunk, neon lights, rain-soaked streets, high contrast' },
]

// ─── Expansion Types / 扩写类型 ────────────────────────────────────────

interface ExpansionTypeOption {
  value: string
  label: string      // 中文 / Chinese
  labelEn: string    // 英文 / English
  skill: string      // 目标 skill / target skill name
  imageOnly: boolean // 是否仅支持图片参考素材 / image-only reference materials
}

const EXPANSION_TYPES: ExpansionTypeOption[] = [
  { value: 'natural_language', label: '自然语言', labelEn: 'Natural Language', skill: 'natural_prompt', imageOnly: true },
  { value: 'danbooru', label: 'Danbooru标签', labelEn: 'Danbooru Tags', skill: 'danbooru_prompt', imageOnly: true },
  { value: 'minimax_h3', label: 'Minimax-H3', labelEn: 'Minimax-H3', skill: 'minimax_h3', imageOnly: false },
]

// 自然语言模型类型 / Natural language model types
const NATURAL_MODELS = [
  { value: 'krea2', label: 'Krea 2' },
  { value: 'z-image', label: 'Z-Image' },
  { value: 'flux', label: 'FLUX.1' },
  { value: 'qwen-image', label: 'Qwen-Image' },
]

// Danbooru 模型类型 / Danbooru model types
const DANBOORU_MODELS = [
  { value: 'anima', label: 'Anima' },
  { value: 'sdxl', label: 'SDXL' },
]

// ─── Component / 组件 ───────────────────────────────────────────────────

const ExpandPage: React.FC = () => {
  const { t, language } = useI18n()
  const [duration, setDuration] = useState<number | null>(5)
  const [segmentDuration, setSegmentDuration] = useState<number | null>(null)  // 分段时长，null=跟随目标时长 / segment duration, null = follow target
  const [genMode, setGenMode] = useState<string>('T2VA')                // H3生成模式 / Generation mode
  const [visualStyle, setVisualStyle] = useState<string>('')            // 视觉风格 / Visual style
  const [materials, setMaterials] = useState<MaterialRef[]>([])
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [description, setDescription] = useState('')
  const textAreaRef = useRef<any>(null)
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [result, setResult] = useState('')
  const [segments, setSegments] = useState<SegmentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [expansionType, setExpansionType] = useState<string>('minimax_h3')   // 扩写类型 / expansion type
  const [modelType, setModelType] = useState<string>('flux')                 // 模型类型 / model type
  const [targetLength, setTargetLength] = useState<number | null>(500)       // 扩写长度(字符) / target length
  const [outputLanguage, setOutputLanguage] = useState<string>('zh')         // 输出语言 / output language

  // 输出语言选项（按当前界面语言）/ output language options (localized)
  const outputLanguageOptions = [
    { value: 'zh', label: t('options.outputZh') },
    { value: 'en', label: t('options.outputEn') },
  ]

  // Cleanup preview URLs on unmount / 卸载时清理Object URL
  useEffect(() => {
    return () => {
      materials.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })
    }
  }, [materials])

  // 挂载时读取已持久化的分段时长 / load persisted segment duration on mount
  useEffect(() => {
    let cancelled = false
    configApi.get().then((res) => {
      const seg = res.data?.features?.expand?.segment_duration
      if (!cancelled && typeof seg === 'number' && seg > 0) setSegmentDuration(seg)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Handle material upload / 处理素材上传 ──────────────────────────
  const handleMaterialUpload = useCallback((files: UploadFile[]) => {
    // Clean old preview URLs / 清理旧URL
    materials.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })

    resetTagCounter()
    const newMaterials: MaterialRef[] = files.map((file) => {
      const mediaType = guessMediaType(file)
      const tag = getNextTag(mediaType)
      // Create preview URL for images / 为图片创建预览URL
      let previewUrl = ''
      if (mediaType === 'image' && file.originFileObj) {
        previewUrl = URL.createObjectURL(file.originFileObj)
      }
      return {
        id: tag,
        fileName: file.name,
        type: mediaType,
        file,
        previewUrl,
      }
    })
    setMaterials(newMaterials)
    setUploadFiles(files)

    message.success(t('expand.materialsLoaded').replace('{n}', String(newMaterials.length)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials])

  // ── Handle clearing materials / 清空素材 ───────────────────────────
  const handleClearMaterials = () => {
    materials.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })
    setMaterials([])
    setUploadFiles([])
    resetTagCounter()
  }

  // ── Handle removing a single material / 删除单个素材 ───────────────
  const handleRemoveMaterial = (id: string) => {
    const target = materials.find(m => m.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    setMaterials(materials.filter(m => m.id !== id))
    if (target) {
      setUploadFiles(uploadFiles.filter(f => f.uid !== target.file.uid))
    }
  }

  // ── Handle expansion type switch / 处理扩写类型切换 ──────────────────
  const handleTypeChange = (val: string) => {
    setExpansionType(val)
    setResult('')
    setSegments([])
    const option = EXPANSION_TYPES.find(t => t.value === val)
    // 切换到仅图片类型时，清空可能残留的视频/音频素材 / clear video/audio materials when switching to image-only type
    if (option?.imageOnly && materials.some(m => m.type !== 'image')) {
      handleClearMaterials()
    }
    // 重置模型类型为该类型默认项 / reset model type to the type's default
    setModelType(val === 'danbooru' ? 'anima' : 'flux')
  }

  // ── Handle segment duration change / 处理分段时长变更 ─────────────
  const handleSegmentChange = (val: number | null) => {
    setSegmentDuration(val)
    // 持久化分段时长（清空则存 null 回到「跟随目标时长」）
    // / persist segment duration (null = back to follow target)
    configApi.update({ 'features.expand.segment_duration': val ?? null }).catch(() => {})
  }

  // ── Handle @ mention trigger / 处理@引用触发 ────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setDescription(value)

    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\S*)$/)

    if (atMatch) {
      setMentionFilter(atMatch[1])
      setShowMention(true)
    } else {
      setShowMention(false)
    }
  }

  // ── Handle material chip click (insert tag) / 点击素材缩略图插入引用 ──
  const handleChipClick = (material: MaterialRef) => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea
    if (textArea) {
      const cursorPos = textArea.selectionStart || description.length
      const newText = description.slice(0, cursorPos) + material.id + ' ' + description.slice(cursorPos)
      setDescription(newText)
      setTimeout(() => {
        textArea.focus()
        const newPos = cursorPos + material.id.length + 1
        textArea.setSelectionRange(newPos, newPos)
      }, 50)
    } else {
      setDescription(prev => prev + material.id + ' ')
    }
  }

  // ── Handle @ mention selection / 处理@下拉选择 ──────────────────────
  const handleMentionSelect = (material: MaterialRef) => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea
    if (textArea) {
      const cursorPos = textArea.selectionStart || description.length
      const textBeforeCursor = description.slice(0, cursorPos)
      const textAfterCursor = description.slice(cursorPos)
      const atIndex = textBeforeCursor.lastIndexOf('@')
      if (atIndex >= 0) {
        const newText = textBeforeCursor.slice(0, atIndex) + material.id + ' ' + textAfterCursor
        setDescription(newText)
        setTimeout(() => {
          textArea.focus()
          const newPos = atIndex + material.id.length + 1
          textArea.setSelectionRange(newPos, newPos)
        }, 50)
      }
    }
    setShowMention(false)
  }

  // ── Generate / 生成 ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!description.trim()) {
      message.warning(t('expand.needDescription'))
      return
    }
    setLoading(true)
    setSegments([])
    try {
      const images: string[] = []
      for (const m of materials) {
        if (m.type !== 'image') continue
        const origin = m.file.originFileObj
        if (origin) images.push(await fileToDataUrl(origin))
      }

      const option = EXPANSION_TYPES.find(t => t.value === expansionType)
      const payload: Parameters<typeof expandApi.generate>[0] = {
        expansion_type: expansionType,
        skill_name: option?.skill,
        short_prompt: description,
        images,
        output_language: outputLanguage,
      }
      if (expansionType === 'minimax_h3') {
        payload.target_duration = duration || 5
        payload.segment_duration = segmentDuration
        payload.generation_mode = genMode
        payload.visual_style = visualStyle || ''
      } else {
        payload.model_type = modelType
        payload.target_length = targetLength || 500
      }

      const response = await expandApi.generate(payload)
      if (response.data.success) {
        setResult(response.data.result || '')
        setSegments(response.data.segments || [])
        message.success(t('expand.done'))
      } else {
        message.error(response.data.error || t('expand.generationFailed'))
      }
    } catch (err: any) {
      message.error(t('expand.requestFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    message.success(t('expand.copied'))
    setTimeout(() => setCopied(false), 2000)
  }

  // 复制单个分段提示词 / copy a single segment prompt
  const copySegment = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success(t('expand.copied'))
  }

  // 一键拷贝所有分段提示词 / copy all segment prompts at once
  const copyAllSegments = () => {
    const text = segments.map((seg) => {
      const header = t('expand.copyAllHeader')
        .replace('{index}', String(seg.index))
        .replace('{duration}', String(seg.duration))
      return `${header}\n${seg.content}`
    }).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    message.success(t('expand.copied'))
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // ── Material type color / 素材类型颜色 ──────────────────────────────
  const getMaterialColor = (type: string) => {
    switch (type) { case 'image': return 'blue'; case 'video': return 'purple'; case 'audio': return 'orange'; default: return 'default' }
  }

  const getMaterialIcon = (type: string) => {
    switch (type) { case 'image': return <PictureOutlined />; case 'video': return <VideoCameraOutlined />; case 'audio': return <AudioOutlined />; default: return <PaperClipOutlined /> }
  }

  // Filtered materials for @ mention / @引用过滤结果
  const filteredMaterials = useMemo(() =>
    materials.filter(m =>
      !mentionFilter || m.id.toLowerCase().includes(mentionFilter.toLowerCase()) ||
      m.fileName.toLowerCase().includes(mentionFilter.toLowerCase())
    ),
    [materials, mentionFilter]
  )

  // ── Render / 渲染 ──────────────────────────────────────────────────
  return (
    <div>
      <Title level={3}>{t('expand.title')}</Title>
      <Text type="secondary">{t('expand.description')}</Text>

      {/* 扩写类型 / Expansion Type */}
      <Card title={t('expand.type')} size="small" style={{ marginTop: 16 }}>
        <Select
          value={expansionType}
          onChange={handleTypeChange}
          style={{ width: '100%' }}
          options={EXPANSION_TYPES.map(t => ({ value: t.value, label: pick(language, t.label, t.labelEn) }))}
        />
      </Card>

      {/* 输出语言 / Output Language */}
      <Card title={t('expand.outputLanguage')} size="small" style={{ marginTop: 12 }}>
        <Select
          value={outputLanguage}
          onChange={(val) => setOutputLanguage(val)}
          style={{ width: 240 }}
          options={outputLanguageOptions}
        />
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* ====== Left Column: Config ====== */}
        <Col xs={24} lg={10}>
          {expansionType === 'minimax_h3' ? (
            <>
          {/* (1) Target Duration + Segment Duration */}
          <Card title={t('expand.duration')} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Text type="secondary">{t('expand.duration')}</Text>
                <InputNumber min={1} max={120} step={1} precision={0}
                  value={duration} onChange={(val) => setDuration(val)}
                  addonAfter={t('expand.seconds')} style={{ width: 160 }}
                />
              </Space>
              <Space>
                <Text type="secondary">{t('expand.segmentDuration')}</Text>
                <InputNumber min={1} max={120} step={1} precision={0}
                  value={segmentDuration ?? duration} onChange={handleSegmentChange}
                  addonAfter={t('expand.seconds')} style={{ width: 160 }}
                />
                <Tooltip title={t('expand.segmentHint')}>
                  <Text type="secondary" style={{ cursor: 'help' }}>{t('expand.segmentAuto')}</Text>
                </Tooltip>
              </Space>
            </Space>
          </Card>

          {/* (1.5) H3 Generation Mode / H3生成模式 */}
          <Card title={t('expand.mode')} size="small" style={{ marginTop: 12 }}>
            <Select
              value={genMode}
              onChange={(val) => setGenMode(val)}
              style={{ width: '100%' }}
              optionLabelProp="label"
            >
              {GENERATION_MODES.map((mode) => (
                <Select.Option key={mode.value} value={mode.value} label={pick(language, mode.label, mode.labelEn)}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{pick(language, mode.label, mode.labelEn)}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{pick(language, mode.desc, mode.descEn)}</Text>
                    <br />
                    <Tag style={{ marginTop: 2, fontSize: 10 }}>{pick(language, mode.inputs, mode.inputsEn)}</Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Card>

          {/* (1.6) Visual Style / 视觉风格 */}
          <Card title={t('expand.style')} size="small" style={{ marginTop: 12 }}>
            <Select
              value={visualStyle}
              onChange={(val) => setVisualStyle(val)}
              style={{ width: '100%' }}
              allowClear
              placeholder={t('expand.noStyle')}
              showSearch
              optionFilterProp="label"
              options={[
                { value: '', label: t('expand.noStyle') },
                ...VISUAL_STYLES.map((s) => ({
                  value: s.value,
                  label: pick(language, s.label, s.labelEn),
                })),
              ]}
              optionRender={(option) => {
                const style = VISUAL_STYLES.find(s => s.value === option.value)
                if (!style) return <div style={{ fontWeight: 500, color: '#888' }}>{option.label}</div>
                return (
                  <div>
                    <div style={{ fontWeight: 500 }}>{pick(language, style.label, style.labelEn)}</div>
                    <Space size={4}>
                      <Tag color="blue" style={{ fontSize: 10 }}>{pick(language, style.category, style.categoryEn)}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>{style.enLabel}</Text>
                    </Space>
                  </div>
                )
              }}
            />
          </Card>
          </>
        ) : (
          <>
            {/* 模型类型 / Model Type */}
            <Card title={t('expand.modelType')} size="small">
              <Select
                value={modelType}
                onChange={(val) => setModelType(val)}
                style={{ width: '100%' }}
                options={(expansionType === 'danbooru' ? DANBOORU_MODELS : NATURAL_MODELS).map(m => ({
                  value: m.value,
                  label: m.label,
                }))}
              />
            </Card>

            {/* 扩写长度 / Target Length */}
            <Card title={t('expand.targetLength')} size="small" style={{ marginTop: 12 }}>
              <Space>
                <InputNumber min={50} max={10000} step={1} precision={0}
                  value={targetLength} onChange={(val) => setTargetLength(val)}
                  addonAfter={t('expand.chars')} style={{ width: 180 }}
                />
                <Text type="secondary">{t('expand.lengthRange')}</Text>
              </Space>
            </Card>
          </>
        )}

          {/* (2) Reference Materials with Thumbnails */}
          <Card
            title={<Space>{t('expand.materials')}{materials.length > 0 && <Tag color="green">{materials.length} {t('expand.materialsCount')}</Tag>}</Space>}
            size="small" style={{ marginTop: 12 }}
            extra={materials.length > 0 ? (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleClearMaterials}>
                {t('expand.clear')}
              </Button>
            ) : null}
          >
            <Dragger multiple fileList={uploadFiles}
              onChange={({ fileList }) => handleMaterialUpload(fileList)}
              beforeUpload={() => false} accept={expansionType === 'minimax_h3' ? 'image/*,video/*,audio/*' : 'image/*'}
              showUploadList={false} style={{ padding: '12px 0' }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 28 }} /></p>
              <p className="ant-upload-text">{t('expand.uploadText')}</p>
              <p className="ant-upload-hint">
                {expansionType === 'minimax_h3' ? t('expand.uploadHintH3') : t('expand.uploadHintImage')}
              </p>
            </Dragger>

            {/* ====== Material Thumbnail Grid ====== */}
            {materials.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {t('expand.loadedMaterials')}
                </Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {materials.map((m) => (
                    <div key={m.id} style={{ position: 'relative' }}>
                      <Tooltip
                        title={`${m.id} — ${m.fileName}\n${t('expand.clickToInsert')}`}
                        placement="top"
                      >
                        <div
                          onClick={() => handleChipClick(m)}
                          style={{ cursor: 'pointer', textAlign: 'center' }}
                        >
                          <MaterialThumb material={m} size={80} />
                          <div style={{ marginTop: 3 }}>
                            <Tag color={getMaterialColor(m.type)} icon={getMaterialIcon(m.type)}
                              style={{ fontSize: 10, margin: 0, lineHeight: '16px', padding: '0 4px' }}>
                              {m.id}
                            </Tag>
                          </div>
                        </div>
                      </Tooltip>
                      {/* 右上角删除按钮 / top-right delete button */}
                      <Tooltip title={t('expand.deleteMaterial')}>
                        <Button
                          size="small"
                          danger
                          shape="circle"
                          icon={<DeleteOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleRemoveMaterial(m.id) }}
                          style={{
                            position: 'absolute', top: -8, right: -8, width: 22, height: 22,
                            minWidth: 22, padding: 0, fontSize: 12, lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                          }}
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* ====== Right Column: Input + Output ====== */}
        <Col xs={24} lg={14}>
          {/* (3) Material Reference Chips Bar + Requirement Input */}
          <Card
            title={t('expand.requirements')}
            size="small"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('expand.mentionHint')}</Text>}
          >
            {/* Material Reference Chips — visual thumbnails above input */}
            {materials.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 10px',
                background: '#fafafa', borderRadius: 8, marginBottom: 10,
                border: '1px dashed #e0e0e0', alignItems: 'center',
              }}>
                <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>{t('expand.materialsLabel')}:</Text>
                {materials.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip title={`${m.id} — ${m.fileName}\n${t('expand.clickToInsertShort')}`}>
                      <div onClick={() => handleChipClick(m)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          background: '#fff', borderRadius: 6, padding: '3px 8px 3px 4px',
                          border: '1px solid #e8e8e8', transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px #1677ff40'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <MaterialThumb material={m} size={36} />
                        <Text style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{m.id}</Text>
                      </div>
                    </Tooltip>
                    <Tooltip title={t('expand.deleteMaterial')}>
                      <Button
                        size="small" danger type="text" icon={<DeleteOutlined />}
                        onClick={() => handleRemoveMaterial(m.id)}
                        style={{ padding: 0, minWidth: 18, height: 18, fontSize: 11, lineHeight: 1 }}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea with @ mention */}
            <div style={{ position: 'relative' }}>
              <TextArea ref={textAreaRef} rows={6}
                placeholder={
                  expansionType === 'minimax_h3'
                    ? t('expand.requirementsPlaceholderH3').replace('{duration}', String(duration || 5))
                    : t('expand.requirementsPlaceholderImage')
                }
                value={description} onChange={handleInputChange}
                maxLength={5000} showCount
              />

              {/* @ Mention Dropdown with Thumbnails */}
              {showMention && materials.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 8, left: 8,
                  background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1000,
                  maxHeight: 260, overflow: 'auto', minWidth: 300, padding: 4,
                }}>
                  <div style={{ padding: '4px 2px 6px 8px', fontSize: 11, color: '#aaa', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                    {t('expand.selectMaterial')}
                  </div>
                  {filteredMaterials.map((m) => (
                    <div key={m.id} onClick={() => handleMentionSelect(m)}
                      style={{
                        padding: '6px 8px', cursor: 'pointer', borderRadius: 6,
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f5ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <MaterialThumb material={m} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 13 }}>{m.id}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                            {m.fileName}
                          </Text>
                        </div>
                      </div>
                      <Tag color={getMaterialColor(m.type)} icon={getMaterialIcon(m.type)}
                        style={{ fontSize: 10, margin: 0 }}>
                        {m.type}
                      </Tag>
                    </div>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <div style={{ padding: '12px 16px', color: '#999', fontSize: 13, textAlign: 'center' }}>
                      {t('expand.noMatch')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* (4) Generate Button */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button type="primary" size="large" icon={<ThunderboltOutlined />}
              onClick={handleGenerate} loading={loading} disabled={!description.trim()}
            >
              {loading ? t('expand.generating') : t('expand.generate')}
            </Button>
          </div>
        </Col>
      </Row>

      {/* (5) Output Area */}
      {segments.length > 0 ? (
        <Card title={t('expand.result')} style={{ marginTop: 16 }}
          extra={
            <Button icon={<CopyOutlined />} type={copiedAll ? 'primary' : 'default'} onClick={copyAllSegments}>
              {copiedAll ? t('expand.copied') : t('expand.copyAll')}
            </Button>
          }
        >
          {segments.map((seg) => (
            <Card key={seg.index} size="small" style={{ marginTop: 12 }}
              title={`${t('expand.segment')} ${seg.index}`}
              extra={
                <Space>
                  <Tag color="blue">{seg.duration} {t('expand.seconds')}</Tag>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => copySegment(seg.content)}>
                    {t('common.copy')}
                  </Button>
                </Space>
              }
            >
              <TextArea readOnly autoSize={{ minRows: 6, maxRows: 12 }} value={seg.content} />
            </Card>
          ))}
        </Card>
      ) : (
        <Card title={t('expand.result')} style={{ marginTop: 16 }}
          extra={result ? (
            <Button icon={<CopyOutlined />} onClick={handleCopy}
              type={copied ? 'primary' : 'default'}>
              {copied ? t('expand.copied') : t('common.copy')}
            </Button>
          ) : null}
        >
          {result ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit',
              background: '#f6f8fa', padding: 20, borderRadius: 8,
              maxHeight: 600, overflow: 'auto', lineHeight: 1.8,
              fontSize: 14, minHeight: 200 }}>
              {result}
            </pre>
          ) : (
            <div style={{ minHeight: 200, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#bbb', fontSize: 14,
              background: '#fafafa', borderRadius: 8 }}>
              {t('expand.emptyResult')}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default ExpandPage
