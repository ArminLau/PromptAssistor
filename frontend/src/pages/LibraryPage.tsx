/**
 * F4: 提示词维护 (Prompt Library)
 */

import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Input, Tag, Space, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, StarOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { libraryApi, PromptItem } from '../services/api'

const { Title, Text } = Typography

const LibraryPage: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const loadPrompts = async () => {
    setLoading(true)
    try {
      const response = await libraryApi.list({ search: search || undefined })
      if (response.data.success) {
        setPrompts(response.data.prompts || [])
      }
    } catch (err: any) {
      message.error('加载失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrompts()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await libraryApi.delete(id)
      message.success('已删除')
      loadPrompts()
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || '未知错误'))
    }
  }

  const columns: ColumnsType<PromptItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.content.slice(0, 100)}...
          </Text>
        </div>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (text) => <Tag>{text || 'General'}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[]) => (
        <Space wrap size="small">
          {tags?.slice(0, 5).map((tag) => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source_type',
      width: 80,
      render: (text) => {
        const map: Record<string, string> = { reverse: '反推', expand: '扩写', manual: '手动', batch: '批量' }
        return map[text] || text
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<StarOutlined />} size="small" />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>提示词库</Title>
          <Text type="secondary">管理保存的提示词，支持搜索、分类和收藏</Text>
        </div>
        <Space>
          <Input
            placeholder="搜索提示词..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={loadPrompts}
            style={{ width: 240 }}
          />
          <Button icon={<PlusOutlined />}>手动添加</Button>
        </Space>
      </div>

      <Card style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={prompts}
          loading={loading}
          size="middle"
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  )
}

export default LibraryPage
