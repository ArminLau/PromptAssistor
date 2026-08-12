/**
 * F3: 数据集批量打标 (Batch Tagging)
 */

import React, { useState } from 'react'
import { Card, Button, Upload, Typography, message, Table, Progress } from 'antd'
import { InboxOutlined, ThunderboltOutlined, DownloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { batchApi } from '../services/api'

const { Dragger } = Upload
const { Title, Text } = Typography

const BatchPage: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleBatchTag = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传文件')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('skill_name', 'minimax_h3')
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj)
        }
      })

      const response = await batchApi.tag(formData)
      if (response.data.success) {
        setResults(response.data.results || [])
        setProgress(100)
        message.success(`批量打标完成，共处理 ${response.data.total} 个文件`)
      } else {
        message.error(response.data.error || '打标失败')
      }
    } catch (err: any) {
      message.error('请求失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Title level={3}>数据集批量打标</Title>
      <Text type="secondary">
        批量上传图片或视频，AI 将为每个文件生成标签和提示词，支持导出为 CSV/JSON 格式。
      </Text>

      <Card style={{ marginTop: 16 }}>
        <Dragger
          multiple
          directory
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          beforeUpload={() => false}
          accept="image/*,video/*"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件夹到此区域</p>
          <p className="ant-upload-hint">支持批量上传图片和视频</p>
        </Dragger>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={handleBatchTag}
            loading={loading}
          >
            开始批量打标
          </Button>
        </div>

        {loading && (
          <Progress percent={progress} style={{ marginTop: 16 }} />
        )}
      </Card>

      {results.length > 0 && (
        <Card
          title={`处理结果 (${results.length} 个文件)`}
          style={{ marginTop: 16 }}
          extra={<Button icon={<DownloadOutlined />}>导出结果</Button>}
        >
          <Table
            dataSource={results.map((r, i) => ({ ...r, key: i }))}
            columns={[
              { title: '#', dataIndex: 'key', width: 60 },
              { title: '标签/结果', dataIndex: 'text', ellipsis: true },
              { title: '模型', dataIndex: 'model', width: 120 },
            ]}
            size="small"
            pagination={{ pageSize: 20 }}
          />
        </Card>
      )}
    </div>
  )
}

export default BatchPage
