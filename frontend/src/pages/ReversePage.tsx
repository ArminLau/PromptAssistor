/**
 * F1: 提示词反推 / Prompt Reverse Engineering
 *
 * Upload images/videos + optional requirement text → AI analyzes and generates the prompt.
 * / 上传图片/视频 + 可选需求描述 → AI分析并反推生成提示词。
 */

import React, { useState } from 'react'
import { Card, Upload, Button, Input, Space, Typography, message, Divider } from 'antd'
import { InboxOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { reverseApi } from '../services/api'

const { Dragger } = Upload
const { TextArea } = Input
const { Title, Text } = Typography

const ReversePage: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [requirements, setRequirements] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传图片或视频 / Please upload images or videos first')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('skill_name', 'minimax_h3')
      if (requirements.trim()) {
        formData.append('user_text', requirements.trim())
      }
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('images', file.originFileObj)
        }
      })

      const response = await reverseApi.generate(formData)
      if (response.data.success) {
        setResult(response.data.result || '')
        message.success('提示词反推完成 / Prompt reverse complete')
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
    message.success('已复制到剪贴板 / Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <Title level={3}>提示词反推 / Prompt Reverse</Title>
      <Text type="secondary">
        上传图片或视频，AI 将分析内容并反推出能够生成该内容的高质量提示词
        / Upload images or videos, AI analyzes and reverse-engineers the generation prompt.
      </Text>

      {/* Upload Area / 上传区域 */}
      <Card style={{ marginTop: 16 }}>
        <Dragger
          multiple
          listType="picture"
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          beforeUpload={() => false}
          accept="image/*,video/*"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传 / Click or drag files here</p>
          <p className="ant-upload-hint">支持图片和视频格式 / Supports image and video formats</p>
        </Dragger>
      </Card>

      {/* Requirements Input / 需求描述 */}
      <Card style={{ marginTop: 16 }} title="反推需求描述 / Reverse Requirements (可选/Optional)">
        <TextArea
          rows={3}
          placeholder={
            '描述你对反推结果的要求，例如：\n' +
            '- 提示词长度：简短/中等/详细\n' +
            '- 风格倾向：写实/插画/3D/概念艺术\n' +
            '- 重点关注的元素：人物表情/光影效果/构图等\n' +
            '- 其他特殊要求\n\n' +
            'Describe your requirements, e.g.: prompt length, style preference, key elements to focus on...'
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

      {/* Result Output / 结果输出 */}
      {result && (
        <Card
          title="生成结果 / Generated Prompt"
          style={{ marginTop: 16 }}
          extra={
            <Button
              icon={<CopyOutlined />}
              onClick={handleCopy}
              type={copied ? 'primary' : 'default'}
            >
              {copied ? '已复制 / Copied' : '复制 / Copy'}
            </Button>
          }
        >
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            background: '#f6f8fa',
            padding: 16,
            borderRadius: 8,
            maxHeight: 600,
            overflow: 'auto',
            lineHeight: 1.8,
            fontSize: 14,
          }}>
            {result}
          </pre>
        </Card>
      )}
    </div>
  )
}

export default ReversePage
