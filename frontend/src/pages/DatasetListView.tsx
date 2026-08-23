/**
 * F3: 数据集列表视图 / Dataset List View.
 *
 * Grid of dataset cards (cover + name + count), with fuzzy search and
 * create / rename / delete actions. Clicking a card opens its detail view.
 * / 数据集卡片网格（封面+名称+数量），支持模糊搜索与新建/重命名/删除操作。
 * 点击卡片进入其详情视图。
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Col, Empty, Input, message, Modal, Row, Spin, Typography,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, FileImageOutlined, FolderAddOutlined, PlusOutlined,
} from '@ant-design/icons'
import { batchApi, type DatasetInfo } from '../services/api'
import { useI18n } from '../i18n'

const { Title, Text } = Typography

const DatasetListView: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useI18n()

  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const [renameTarget, setRenameTarget] = useState<DatasetInfo | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DatasetInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDatasets = async (keyword?: string) => {
    setLoading(true)
    try {
      const res = await batchApi.listDatasets(keyword || undefined)
      setDatasets(res.data.datasets || [])
    } catch (e: any) {
      message.error(t('batch.loadFailed') + ': ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // 初始加载 + 搜索防抖 / initial load + debounced search
  useEffect(() => {
    const timer = setTimeout(() => loadDatasets(search), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name) {
      message.warning(t('batch.enterName'))
      return
    }
    setCreating(true)
    try {
      await batchApi.createDataset(name)
      message.success(t('batch.created'))
      setCreateOpen(false)
      setCreateName('')
      loadDatasets(search)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const openRename = (dataset: DatasetInfo) => {
    setRenameTarget(dataset)
    setRenameName(dataset.name)
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameName.trim()
    if (!name) {
      message.warning(t('batch.enterNewName'))
      return
    }
    if (name === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    setRenaming(true)
    try {
      await batchApi.renameDataset(renameTarget.name, name)
      message.success(t('batch.renamed'))
      setRenameTarget(null)
      loadDatasets(search)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.renameFailed'))
    } finally {
      setRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await batchApi.deleteDataset(deleteTarget.name)
      message.success(t('batch.deleted'))
      setDeleteTarget(null)
      loadDatasets(search)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{t('batch.title')}</Title>
          <Text type="secondary">{t('batch.description')}</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Input.Search
            placeholder={t('batch.searchPlaceholder')}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('batch.createDataset')}
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {datasets.length === 0 && !loading ? (
          <Empty
            style={{ marginTop: 80 }}
            description={t('batch.noDatasets')}
          >
            <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setCreateOpen(true)}>
              {t('batch.createDataset')}
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {datasets.map((ds) => {
              const coverUrl = ds.cover_filename
                ? batchApi.imageUrl(ds.name, ds.cover_filename)
                : null
              return (
                <Col key={ds.name} xs={24} sm={12} md={8} lg={6} xl={4}>
                  <Card
                    hoverable
                    size="small"
                    cover={
                      <div
                        onClick={() => navigate(`/batch/${encodeURIComponent(ds.name)}`)}
                        style={{
                          height: 150,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          background: '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={ds.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <FileImageOutlined style={{ fontSize: 40, color: '#bbb' }} />
                        )}
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <a onClick={() => navigate(`/batch/${encodeURIComponent(ds.name)}`)}>
                          {ds.name}
                        </a>
                      }
                      description={`${ds.item_count} ${t('batch.images')}`}
                    />
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openRename(ds)}
                      >
                        {t('common.rename')}
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setDeleteTarget(ds)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>

      {/* 新建数据集弹窗 / Create dataset modal */}
      <Modal
        title={t('batch.createModalTitle')}
        open={createOpen}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        confirmLoading={creating}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); setCreateName('') }}
      >
        <Input
          placeholder={t('batch.createPlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onPressEnter={handleCreate}
          maxLength={200}
        />
      </Modal>

      {/* 重命名弹窗 / Rename modal */}
      <Modal
        title={`${t('batch.renameModalTitle')} "${renameTarget?.name ?? ''}"`}
        open={renameTarget !== null}
        okText={t('batch.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={renaming}
        onOk={handleRename}
        onCancel={() => setRenameTarget(null)}
      >
        <Input
          placeholder={t('batch.renamePlaceholder')}
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onPressEnter={handleRename}
          maxLength={200}
        />
      </Modal>

      {/* 删除确认弹窗 / Delete confirmation modal */}
      <Modal
        title={t('batch.deleteConfirmTitle').replace('{name}', deleteTarget?.name ?? '')}
        open={deleteTarget !== null}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
        onOk={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p>{t('batch.deleteConfirmContent')}</p>
      </Modal>
    </div>
  )
}

export default DatasetListView
