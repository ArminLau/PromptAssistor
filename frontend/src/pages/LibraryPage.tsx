/**
 * F4: 提示词维护 (Prompt Library)
 * / Prompt Library — manage saved prompts.
 */

import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Input, Tag, Space, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, StarOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { libraryApi, PromptItem } from '../services/api'
import { useI18n } from '../i18n'

const { Title, Text } = Typography

const LibraryPage: React.FC = () => {
  const { t, language } = useI18n()
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
      message.error(t('library.loadFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrompts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await libraryApi.delete(id)
      message.success(t('library.deleted'))
      loadPrompts()
    } catch (err: any) {
      message.error(t('library.deleteFailed') + ': ' + (err.message || t('common.unknownError')))
    }
  }

  // 来源类型 → 显示文本 / source type → display label
  const sourceLabel = (text: string): string => {
    const map: Record<string, string> = {
      reverse: t('library.source.reverse'),
      expand: t('library.source.expand'),
      manual: t('library.source.manual'),
      batch: t('library.source.batch'),
    }
    return map[text] || text
  }

  const columns: ColumnsType<PromptItem> = [
    {
      title: t('library.column.title'),
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
      title: t('library.column.model'),
      dataIndex: 'model_name',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: t('library.column.category'),
      dataIndex: 'category',
      width: 100,
      render: (text) => <Tag>{text || 'General'}</Tag>,
    },
    {
      title: t('library.column.tags'),
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
      title: t('library.column.source'),
      dataIndex: 'source_type',
      width: 80,
      render: (text) => sourceLabel(text),
    },
    {
      title: t('library.column.updated'),
      dataIndex: 'updated_at',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '-',
    },
    {
      title: t('library.column.actions'),
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<StarOutlined />} size="small" />
          <Popconfirm title={t('library.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
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
          <Title level={3} style={{ marginBottom: 0 }}>{t('library.title')}</Title>
          <Text type="secondary">{t('library.description')}</Text>
        </div>
        <Space>
          <Input
            placeholder={t('library.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={loadPrompts}
            style={{ width: 240 }}
          />
          <Button icon={<PlusOutlined />}>{t('library.manualAdd')}</Button>
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
