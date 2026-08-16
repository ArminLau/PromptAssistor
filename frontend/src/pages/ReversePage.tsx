/**
 * F1: 提示词反推 / Prompt Reverse Engineering
 *
 * Upload multiple images + optional requirement text → AI reverse-engineers a prompt
 * for each image, targeting the selected model skill.
 * / 上传多张图片 + 可选需求描述 → AI 为每张图片反推出适用于目标模型的提示词，逐图展示。
 */

import React, { useState, useEffect } from 'react'
import {
  Card, Upload, Button, Input, InputNumber, Typography, message,
  Row, Col, Select, Spin, Image as AntImage,
} from 'antd'
import {
  InboxOutlined, ThunderboltOutlined, CopyOutlined, FileImageOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { reverseApi } from '../services/api'

const { Dragger } = Upload
const { TextArea } = Input
const { Title, Text } = Typography

// ─── 反推目标 / Reverse targets ──────────────────────────────────────────

const NATURAL_MODELS = [
  { value: 'krea2', label: 'Krea 2' },
  { value: 'z-image', label: 'Z-Image' },
  { value: 'flux', label: 'FLUX.1' },
  { value: 'qwen-image', label: 'Qwen-Image' },
]

const DANBOORU_MODELS = [
  { value: 'anima', label: 'Anima' },
  { value: 'sdxl', label: 'SDXL' },
]

// 下拉分组选项 / grouped select options（value 编码为 `skill:model_type` 或 `reference`）
const REVERSE_TARGET_OPTIONS = [
  {
    label: '完全参考 / Reference Only',
    options: [{ value: 'reference', label: '完全参考反推需求描述 / Fully follow requirement' }],
  },
  {
    label: '自然语言 / Natural Language',
    options: NATURAL_MODELS.map((m) => ({
      value: `natural_prompt:${m.value}`,
      label: `自然语言 ${m.label} / Natural Language ${m.label}`,
    })),
  },
  {
    label: 'Danbooru 标签 / Danbooru Tags',
    options: DANBOORU_MODELS.map((m) => ({
      value: `danbooru_prompt:${m.value}`,
      label: `Danbooru ${m.label}`,
    })),
  },
]

// ─── 反推风格 / Reverse styles ───────────────────────────────────────────

interface ReverseStyleOption {
  value: string
  label: string
  desc: string
}

const REVERSE_STYLES: ReverseStyleOption[] = [
  {
    value: 'five_point',
    label: '自然语言·五点结构式',
    desc: '单段连贯自然语言，按五点结构(构图、主体、环境、文字、风格)极致还原画面，适用于Flux、MJ等自然语言提示词模型。',
  },
  {
    value: 'multi_paragraph',
    label: '自然语言·多段长描述',
    desc: '2-5段自然语言长描述，无Markdown结构，支持角色名。2~5段自然语言，无Markdown小标题。',
  },
  {
    value: 'short',
    label: '自然语言·短描述',
    desc: '简短扼要，覆盖主要对象与细节，无冗长修辞。短段落自然语言描述。',
  },
]

// 解析反推目标值 → { skill, modelType } / parse target value
function parseTarget(val: string): { skill: string; modelType: string } {
  if (!val || val === 'reference') return { skill: '', modelType: '' }
  const idx = val.indexOf(':')
  if (idx < 0) return { skill: val, modelType: '' }
  return { skill: val.slice(0, idx), modelType: val.slice(idx + 1) }
}

const ReversePage: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [requirements, setRequirements] = useState('')
  const [reverseTarget, setReverseTarget] = useState('natural_prompt:krea2')
  const [targetLength, setTargetLength] = useState<number | null>(500)
  const [reverseStyle, setReverseStyle] = useState('five_point')
  const [results, setResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})

  // 生成图片缩略图 objectURL / generate image thumbnail object URLs
  useEffect(() => {
    const map: Record<string, string> = {}
    fileList.forEach((f) => {
      const origin = f.originFileObj as Blob | undefined
      if (origin && (f.type?.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(f.name))) {
        map[f.uid] = URL.createObjectURL(origin)
      }
    })
    setPreviews(map)
    return () => {
      Object.values(map).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [fileList])

  // 文件变化时清空结果 / clear results when files change
  const handleFilesChange = (list: UploadFile[]) => {
    setFileList(list)
    setResults({})
  }

  const handleGenerate = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传图片 / Please upload images first')
      return
    }

    setLoading(true)
    try {
      const { skill, modelType } = parseTarget(reverseTarget)
      const formData = new FormData()
      if (skill) formData.append('skill_name', skill)
      if (modelType) formData.append('model_type', modelType)
      if (requirements.trim()) formData.append('user_text', requirements.trim())
      if (targetLength) formData.append('target_length', String(targetLength))
      if (reverseStyle) formData.append('reverse_style', reverseStyle)

      const orderedUids: string[] = []
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('images', file.originFileObj)
          orderedUids.push(file.uid)
        }
      })

      const response = await reverseApi.generate(formData)
      const data = response.data
      if (data.success && data.results) {
        const next: Record<string, string> = {}
        data.results.forEach((item, i) => {
          next[orderedUids[i]] = item.error
            ? `[错误 / Error: ${item.error}]`
            : (item.result || '')
        })
        setResults(next)
        message.success('提示词反推完成 / Prompt reverse complete')
      } else {
        message.error(data.error || '生成失败 / Generation failed')
      }
    } catch (err: any) {
      message.error('请求失败 / Request failed: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板 / Copied to clipboard')
  }

  return (
    <div>
      <Title level={3}>提示词反推 / Prompt Reverse</Title>
      <Text type="secondary">
        上传多张图片，AI 为每张图片反推出适用于目标模型的高质量提示词
        / Upload images; AI reverse-engineers a prompt for each image targeting the selected model.
      </Text>

      {/* 配置区 / Configuration */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="反推目标 / Reverse Target" size="small">
            <Select
              value={reverseTarget}
              onChange={(val) => { setReverseTarget(val); setResults({}) }}
              style={{ width: '100%' }}
              options={REVERSE_TARGET_OPTIONS}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="提示词长度 / Prompt Length" size="small">
            <InputNumber
              min={50} max={10000} step={1} precision={0}
              value={targetLength} onChange={(val) => setTargetLength(val)}
              addonAfter="字符 / chars" style={{ width: '100%' }}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              50–10000 字符 / characters
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="反推提示词风格 / Reverse Style" size="small">
            <Select
              value={reverseStyle}
              onChange={(val) => setReverseStyle(val)}
              style={{ width: '100%' }}
              optionLabelProp="label"
            >
              {REVERSE_STYLES.map((s) => (
                <Select.Option key={s.value} value={s.value} label={s.label}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{s.label}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{s.desc}</Text>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Card>
        </Col>
      </Row>

      {/* Upload Area / 上传区域 */}
      <Card style={{ marginTop: 16 }}>
        <Dragger
          multiple
          showUploadList={false}
          fileList={fileList}
          onChange={({ fileList }) => handleFilesChange(fileList)}
          beforeUpload={() => false}
          accept="image/*"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽图片到此区域上传 / Click or drag images here</p>
          <p className="ant-upload-hint">支持多张图片 / Supports multiple images</p>
        </Dragger>
      </Card>

      {/* Requirements Input / 需求描述 */}
      <Card style={{ marginTop: 16 }} title="反推需求描述 / Reverse Requirements (优先级最高 / Highest priority)">
        <TextArea
          rows={3}
          placeholder={
            '描述你对反推结果的要求，例如：\n' +
            '- 重点关注的元素：人物表情/光影效果/构图等\n' +
            '- 特殊要求：必须包含的文字、风格倾向等\n' +
            '需求描述的优先级最高，与模型规范冲突时以此为准。\n\n' +
            'Describe your requirements, e.g. key elements to focus on, required text, style preference...\n' +
            'Your requirement has the highest priority and overrides the skill guide on conflict.'
          }
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          maxLength={2000}
          showCount
        />
      </Card>

      {/* Generate Button / 生成按钮 */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
          loading={loading}
          disabled={fileList.length === 0}
        >
          {loading ? '分析中... / Analyzing...' : '开始反推 / Start Reverse'}
        </Button>
      </div>

      {/* 逐图结果 / Per-image results */}
      {fileList.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {fileList.map((file) => {
            const hasResult = file.uid in results
            const res = results[file.uid]
            return (
              <Col key={file.uid} xs={24} md={12} xl={8}>
                <Card
                  size="small"
                  title={<Text ellipsis style={{ maxWidth: 200 }}>{file.name}</Text>}
                  cover={
                    previews[file.uid] ? (
                      <AntImage
                        src={previews[file.uid]}
                        height={160}
                        style={{ objectFit: 'cover', width: '100%' }}
                      />
                    ) : (
                      <div style={{
                        height: 160, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: '#fafafa',
                      }}>
                        <FileImageOutlined style={{ fontSize: 40, color: '#bbb' }} />
                      </div>
                    )
                  }
                  extra={
                    hasResult ? (
                      <Button size="small" icon={<CopyOutlined />} onClick={() => copyPrompt(res)}>
                        复制 / Copy
                      </Button>
                    ) : null
                  }
                >
                  {loading && !hasResult ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                      <Spin />
                    </div>
                  ) : hasResult ? (
                    <pre style={{
                      whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: '#f6f8fa',
                      padding: 12, borderRadius: 8, maxHeight: 260, overflow: 'auto',
                      lineHeight: 1.6, fontSize: 13, margin: 0,
                    }}>
                      {res}
                    </pre>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>等待反推 / Awaiting reverse</Text>
                  )}
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}

export default ReversePage
