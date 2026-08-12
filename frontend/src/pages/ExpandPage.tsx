/**
 * F2: 提示词扩写 / Prompt Expansion
 *
 * Minimax-H3 specific interactive prompt builder.
 * / Minimax-H3 专用交互式提示词构建器。
 *
 * Features / 功能:
 * - Target duration / 目标时长
 * - Reference materials with thumbnails / 参考素材（含缩略图）
 * - @ mention with thumbnail previews / @引用下拉（含缩略图）
 * - Visual material chips above input / 素材缩略图引用条
 * - Generate button / 生成按钮
 * - Large text output / 大文本输出框
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
import { expandApi } from '../services/api'

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
  label: string
  desc: string      // 简短描述 / Short description
  inputs: string    // 所需输入 / Required inputs
}

const GENERATION_MODES: ModeOption[] = [
  { value: 'T2VA', label: 'T2VA — 文生视频 / Text to Video', desc: '纯文本构建完整视听时间线 / Build full audiovisual timeline from text', inputs: '仅文本 / Text only' },
  { value: 'I2VA', label: 'I2VA — 图生视频 / Image to Video', desc: '从首帧图片出发向前发展 / Start from first frame and develop forward', inputs: '文本 + 1张首帧图 / Text + 1 first frame image' },
  { value: 'FL2VA', label: 'FL2VA — 首尾帧生视频 / First-Last Frame', desc: '描述首帧到尾帧的连续变化路径 / Describe path between first and last frames', inputs: '文本 + 首帧图 + 尾帧图 / Text + first + last frame' },
  { value: 'L2VA', label: 'L2VA — 尾帧生视频 / Last Frame to Video', desc: '推断开头并逐渐收敛到尾帧 / Infer opening and converge to last frame', inputs: '文本 + 1张尾帧图 / Text + 1 last frame image' },
  { value: 'Ref2VA', label: 'Ref2VA — 全参考生视频 / Full Reference', desc: '多图+视频+音频全模态参考 / Multi-modal reference generation', inputs: '文本+图(≤9)+视频(≤3)+音频(≤3) / Text+Img(≤9)+Vid(≤3)+Aud(≤3)' },
]

// ─── Visual Style Options / 视觉风格选项 ───────────────────────────────

interface StyleOption {
  value: string
  label: string
  enLabel: string
  category: string  // 分类 / Category
}

const VISUAL_STYLES: StyleOption[] = [
  // 写实类 / Realistic
  { value: 'Cinematic, live-action, film look', label: '电影写实 / Cinematic Live-Action', enLabel: 'Cinematic, live-action, film look', category: '写实 / Realistic' },
  { value: 'Vintage film, 16mm, retro look', label: '复古胶片 / Vintage Film', enLabel: 'Vintage film, 16mm, retro look', category: '写实 / Realistic' },
  { value: 'Documentary, handheld, natural light', label: '纪录片风格 / Documentary', enLabel: 'Documentary, handheld, natural light', category: '写实 / Realistic' },

  // 3D类 / 3D
  { value: '3D CG, Pixar-inspired, Octane render, cartoon rendering', label: '3D动画(皮克斯风) / 3D CG Pixar-style', enLabel: '3D CG, Pixar-inspired, Octane render, cartoon rendering', category: '3D / CG' },
  { value: '3D CG, photorealistic render, Unreal Engine 5 quality', label: '3D写实渲染 / 3D Photorealistic', enLabel: '3D CG, photorealistic render, unreal engine quality', category: '3D / CG' },
  { value: '3D CG, minimalist product render, clean studio lighting', label: '3D产品渲染 / 3D Product Render', enLabel: '3D CG, minimalist product render, clean studio lighting', category: '3D / CG' },

  // 2D类 / 2D
  { value: '2D-animated, hand-drawn animation, cel animation', label: '2D手绘动画 / 2D Hand-Drawn', enLabel: '2D-animated, hand-drawn animation, cel animation', category: '2D / 手绘' },
  { value: 'Anime style, Japanese animation, vibrant colors', label: '日式动画 / Anime Style', enLabel: 'Anime style, Japanese animation, vibrant colors', category: '2D / 手绘' },
  { value: 'Watercolor style, hand-painted look, soft brushstrokes', label: '水彩手绘 / Watercolor', enLabel: 'Watercolor style, hand-painted look, soft brushstrokes', category: '2D / 手绘' },
  { value: 'Ink wash painting, sumi-e style, traditional Chinese art', label: '水墨画 / Ink Wash Painting', enLabel: 'Ink wash painting, sumi-e style, traditional Chinese art', category: '2D / 手绘' },

  // 定格动画类 / Stop-Motion
  { value: 'Stop-motion, claymation, textured handmade feel', label: '黏土定格 / Claymation', enLabel: 'Stop-motion, claymation, textured handmade feel', category: '定格 / Stop-Motion' },
  { value: 'Papercraft stop-motion, layered diorama, cut-paper style', label: '纸艺定格 / Papercraft Stop-Motion', enLabel: 'Papercraft stop-motion, layered diorama, cut-paper style', category: '定格 / Stop-Motion' },
  { value: 'Paper collage, mixed media, tactile halftone texture', label: '拼贴画风 / Paper Collage', enLabel: 'Paper collage, mixed media, tactile halftone texture', category: '定格 / Stop-Motion' },

  // 特殊效果类 / Special Effects
  { value: 'Hand-drawn animation overlaying live-action, rough glowing lines', label: '手绘叠加实拍 / Hand-Drawn on Live-Action', enLabel: 'Hand-drawn animation overlaying live-action, rough glowing lines', category: '特效 / Effects' },
  { value: 'Product photography, commercial, clean minimal, Scandinavian design', label: '极简产品广告 / Minimalist Product', enLabel: 'Product photography, commercial, clean minimal', category: '商业 / Commercial' },
  { value: 'Cyberpunk, neon lights, rain-soaked streets, high contrast', label: '赛博朋克 / Cyberpunk', enLabel: 'Cyberpunk, neon lights, rain-soaked streets, high contrast', category: '特效 / Effects' },
]

// ─── Component / 组件 ───────────────────────────────────────────────────

const ExpandPage: React.FC = () => {
  const [duration, setDuration] = useState<number | null>(5)
  const [genMode, setGenMode] = useState<string>('T2VA')                // H3生成模式 / Generation mode
  const [visualStyle, setVisualStyle] = useState<string>('')            // 视觉风格 / Visual style
  const [materials, setMaterials] = useState<MaterialRef[]>([])
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [description, setDescription] = useState('')
  const textAreaRef = useRef<any>(null)
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Cleanup preview URLs on unmount / 卸载时清理Object URL
  useEffect(() => {
    return () => {
      materials.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })
    }
  }, [materials])

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

    // Auto-insert reference tags into description / 自动插入引用标签
    if (newMaterials.length > 0) {
      const tags = newMaterials.map(m => m.id).join(' ')
      setDescription(prev => {
        if (prev.includes(tags)) return prev
        const line = `素材引用 / Material refs: ${tags}`
        return prev ? `${prev}\n${line}` : line
      })
    }

    message.success(`已加载 ${newMaterials.length} 个素材 / ${newMaterials.length} material(s) loaded`)
  }, [])

  // ── Handle clearing materials / 清空素材 ───────────────────────────
  const handleClearMaterials = () => {
    materials.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })
    setMaterials([])
    setUploadFiles([])
    resetTagCounter()
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
      // Focus back and move cursor / 恢复焦点和光标位置
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
      message.warning('请输入需求描述 / Please enter requirement description')
      return
    }
    setLoading(true)
    try {
      const response = await expandApi.generate({
        skill_name: 'minimax_h3',
        short_prompt: description,
        target_duration: duration || 5,
        material_count: materials.length,
        generation_mode: genMode,              // H3模式 / H3 mode
        visual_style: visualStyle || '',        // 视觉风格 / Visual style
      })
      if (response.data.success) {
        setResult(response.data.result || '')
        message.success('提示词生成完成 / Prompt generation complete')
      } else {
        message.error(response.data.error || '生成失败 / Generation failed')
      }
    } catch (err: any) {
      message.error('请求失败 / Request failed: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    message.success('已复制 / Copied')
    setTimeout(() => setCopied(false), 2000)
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
      <Title level={3}>提示词扩写 / Prompt Expansion</Title>
      <Text type="secondary">
        Minimax-H3 专用提示词生成器 — 配置参考素材、描述需求，生成专业提示词
        / Minimax-H3 prompt builder — configure materials, describe needs, generate professional prompts.
      </Text>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* ====== Left Column: Config ====== */}
        <Col xs={24} lg={10}>
          {/* (1) Target Duration */}
          <Card title="目标时长 / Target Duration" size="small">
            <Space>
              <InputNumber min={1} max={120} step={1} precision={0}
                value={duration} onChange={(val) => setDuration(val)}
                addonAfter="秒 / seconds" style={{ width: 180 }}
              />
              <Text type="secondary">正整数 / Positive integer</Text>
            </Space>
          </Card>

          {/* (1.5) H3 Generation Mode / H3生成模式 */}
          <Card title="生成模式 / Generation Mode" size="small" style={{ marginTop: 12 }}>
            <Select
              value={genMode}
              onChange={(val) => setGenMode(val)}
              style={{ width: '100%' }}
              optionLabelProp="label"
            >
              {GENERATION_MODES.map((mode) => (
                <Select.Option key={mode.value} value={mode.value} label={mode.label}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{mode.label}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{mode.desc}</Text>
                    <br />
                    <Tag style={{ marginTop: 2, fontSize: 10 }}>{mode.inputs}</Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Card>

          {/* (1.6) Visual Style / 视觉风格 */}
          <Card title="视觉风格 / Visual Style" size="small" style={{ marginTop: 12 }}>
            <Select
              value={visualStyle}
              onChange={(val) => setVisualStyle(val)}
              style={{ width: '100%' }}
              allowClear
              placeholder="不指定风格 / No specific style"
              showSearch
              optionFilterProp="label"
              options={[
                { value: '', label: '不指定(由AI决定) / Auto (AI decides)' },
                ...VISUAL_STYLES.map((s) => ({
                  value: s.value,
                  label: s.label,
                })),
              ]}
              optionRender={(option) => {
                const style = VISUAL_STYLES.find(s => s.value === option.value)
                if (!style) return <div style={{ fontWeight: 500, color: '#888' }}>{option.label}</div>
                return (
                  <div>
                    <div style={{ fontWeight: 500 }}>{style.label}</div>
                    <Space size={4}>
                      <Tag color="blue" style={{ fontSize: 10 }}>{style.category}</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>{style.enLabel}</Text>
                    </Space>
                  </div>
                )
              }}
            />
          </Card>

          {/* (2) Reference Materials with Thumbnails */}
          <Card
            title={<Space>参考素材 / Reference Materials{materials.length > 0 && <Tag color="green">{materials.length} 个</Tag>}</Space>}
            size="small" style={{ marginTop: 12 }}
            extra={materials.length > 0 ? (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleClearMaterials}>
                清空 / Clear
              </Button>
            ) : null}
          >
            <Dragger multiple fileList={uploadFiles}
              onChange={({ fileList }) => handleMaterialUpload(fileList)}
              beforeUpload={() => false} accept="image/*,video/*,audio/*"
              showUploadList={false} style={{ padding: '12px 0' }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 28 }} /></p>
              <p className="ant-upload-text">点击或拖拽素材 / Click or drag materials</p>
              <p className="ant-upload-hint">图片/视频/音频 — 按上传顺序自动打标签</p>
            </Dragger>

            {/* ====== Material Thumbnail Grid ====== */}
            {materials.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  已加载素材 / Loaded materials (点击缩略图可插入引用 / click to insert reference):
                </Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {materials.map((m) => (
                    <Tooltip
                      key={m.id}
                      title={`${m.id} — ${m.fileName}\n点击插入引用 / Click to insert reference`}
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
            title="需求描述 / Requirement Description"
            size="small"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>输入 @ 引用素材 / Type @ to reference</Text>}
          >
            {/* Material Reference Chips — visual thumbnails above input */}
            {materials.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 10px',
                background: '#fafafa', borderRadius: 8, marginBottom: 10,
                border: '1px dashed #e0e0e0', alignItems: 'center',
              }}>
                <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>素材 / Materials:</Text>
                {materials.map((m) => (
                  <Tooltip key={m.id} title={`${m.id} — ${m.fileName}\n点击插入 / Click to insert`}>
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
                ))}
              </div>
            )}

            {/* Textarea with @ mention */}
            <div style={{ position: 'relative' }}>
              <TextArea ref={textAreaRef} rows={6}
                placeholder={
                  '描述你的需求，使用 @ 引用参考素材。例如：\n' +
                  '"使用 <Picture 1> 中的构图风格，结合 <Video 1> 的色彩调性，\n生成一段时长为 ' + (duration || 5) + ' 秒的视频提示词。\n' +
                  '画面需要表达..."\n\n' +
                  'Describe your needs. Use @ to reference materials.\n' +
                  'e.g., "Use the composition from <Picture 1>..."'
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
                    选择素材引用 / Select material to reference:
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
                      无匹配素材 / No matching materials
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
              {loading ? '生成中... / Generating...' : '生成提示词 / Generate Prompt'}
            </Button>
          </div>
        </Col>
      </Row>

      {/* (5) Output Area */}
      <Card title="生成结果 / Generated Prompt" style={{ marginTop: 16 }}
        extra={result ? (
          <Button icon={<CopyOutlined />} onClick={handleCopy}
            type={copied ? 'primary' : 'default'}>
            {copied ? '已复制 / Copied' : '复制 / Copy'}
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
            上传参考素材并填写需求描述后，点击"生成提示词"按钮
            / Upload materials, describe your needs, then click "Generate Prompt"
          </div>
        )}
      </Card>
    </div>
  )
}

export default ExpandPage
