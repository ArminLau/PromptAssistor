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
  Row, Col, Select, Spin, Image as AntImage, Space, Tooltip,
} from 'antd'
import {
  InboxOutlined, ThunderboltOutlined, CopyOutlined, FileImageOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { reverseApi } from '../services/api'
import {
  getOutputLanguages,
  getReverseStyles,
  getReverseTargetOptions,
  parseTarget,
} from '../constants/reverseOptions'
import { useI18n, pick } from '../i18n'

const { Dragger } = Upload
const { TextArea } = Input
const { Title, Text } = Typography

const ReversePage: React.FC = () => {
  const { t, language } = useI18n()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [requirements, setRequirements] = useState('')
  const [reverseTarget, setReverseTarget] = useState('natural_prompt:krea2')
  const [targetLength, setTargetLength] = useState<number | null>(500)
  const [reverseStyle, setReverseStyle] = useState('five_point')
  const [outputLanguage, setOutputLanguage] = useState('zh')
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

  // 删除单张图片 / Remove a single image
  // 预览 objectURL 由 fileList 变化触发的 useEffect 统一回收，这里只更新状态。
  // / The preview object URL is recycled by the fileList-driven useEffect; here we just update state.
  const handleRemoveFile = (uid: string) => {
    setFileList((prev) => prev.filter((f) => f.uid !== uid))
    setResults((prev) => {
      const next = { ...prev }
      delete next[uid]
      return next
    })
  }

  const handleGenerate = async () => {
    if (fileList.length === 0) {
      message.warning(t('reverse.uploadFirst'))
      return
    }

    setLoading(true)
    setResults({})
    try {
      const { skill, modelType } = parseTarget(reverseTarget)
      const formData = new FormData()
      if (skill) formData.append('skill_name', skill)
      if (modelType) formData.append('model_type', modelType)
      if (requirements.trim()) formData.append('user_text', requirements.trim())
      if (targetLength) formData.append('target_length', String(targetLength))
      if (reverseStyle) formData.append('reverse_style', reverseStyle)
      if (outputLanguage) formData.append('output_language', outputLanguage)

      // 按上传顺序记录 uid，后端按同一顺序逐图返回结果，用序号精确映射每张图的结果。
      // / Record uids in upload order; the backend yields results in the same order,
      // so we map the Nth streamed result to the Nth uid by index.
      const orderedUids: string[] = []
      fileList.forEach((file) => {
        if (file.originFileObj) {
          const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
          const sentName = `${file.uid}${ext}`
          formData.append('images', file.originFileObj, sentName)
          orderedUids.push(file.uid)
        }
      })

      // 逐图增量渲染：每张图反推完成立即显示结果 / render each result as it streams in
      let resultIndex = 0
      let receivedCount = 0
      await reverseApi.generateStream(formData, (item) => {
        const uid = orderedUids[resultIndex] ?? item.filename
        resultIndex += 1
        receivedCount += 1
        const text = item.error
          ? `[${pick(language, '错误', 'Error')}: ${item.error}]`
          : (item.result || '')
        setResults((prev) => ({ ...prev, [uid]: text }))
      })
      // 流结束却一条结果都没收到，说明后端返回了空流（可能图片未被接收）。
      // / Stream ended with zero results — the backend returned an empty stream.
      if (receivedCount === 0 && orderedUids.length > 0) {
        message.warning(t('reverse.noResult'))
      } else {
        message.success(t('reverse.done'))
      }
    } catch (err: any) {
      message.error(t('reverse.failed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success(t('common.copied'))
  }

  return (
    <div>
      <Title level={3}>{t('reverse.title')}</Title>
      <Text type="secondary">{t('reverse.description')}</Text>

      {/* 配置区 / Configuration */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={6}>
          <Card title={t('reverse.target')} size="small">
            <Select
              value={reverseTarget}
              onChange={(val) => { setReverseTarget(val); setResults({}) }}
              style={{ width: '100%' }}
              options={getReverseTargetOptions(language)}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title={t('reverse.length')} size="small">
            <InputNumber
              min={50} max={10000} step={1} precision={0}
              value={targetLength} onChange={(val) => setTargetLength(val)}
              addonAfter={t('reverse.chars')} style={{ width: '100%' }}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {t('reverse.lengthRange')}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title={t('reverse.style')} size="small">
            <Select
              value={reverseStyle}
              onChange={(val) => setReverseStyle(val)}
              style={{ width: '100%' }}
              optionLabelProp="label"
            >
              {getReverseStyles(language).map((s) => (
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
        <Col xs={24} md={6}>
          <Card title={t('reverse.outputLanguage')} size="small">
            <Select
              value={outputLanguage}
              onChange={(val) => setOutputLanguage(val)}
              style={{ width: '100%' }}
              options={getOutputLanguages(language)}
            />
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
          <p className="ant-upload-text">{t('reverse.uploadText')}</p>
          <p className="ant-upload-hint">{t('reverse.uploadHint')}</p>
        </Dragger>
      </Card>

      {/* Requirements Input / 需求描述 */}
      <Card style={{ marginTop: 16 }} title={t('reverse.requirements')}>
        <TextArea
          rows={3}
          placeholder={t('reverse.requirementsPlaceholder')}
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
          {loading ? t('reverse.analyzing') : t('reverse.start')}
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
                    <Space size={4}>
                      {hasResult && (
                        <Button size="small" icon={<CopyOutlined />} onClick={() => copyPrompt(res)}>
                          {t('common.copy')}
                        </Button>
                      )}
                      <Tooltip title={t('reverse.deleteImage')}>
                        <Button
                          size="small"
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveFile(file.uid)}
                        />
                      </Tooltip>
                    </Space>
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
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('reverse.awaiting')}</Text>
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
