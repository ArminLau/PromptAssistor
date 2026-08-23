/**
 * F3: 数据集详情视图 / Dataset Detail View.
 *
 * Left panel: the dataset's independent reverse configuration. Right panel:
 * toolbar (add / select-all / batch-tag / delete-selected) and a paginated
 * grid of item cards (image + prompt, with per-item tag & delete).
 * / 左侧：该数据集独立的反推配置。右侧：工具栏（添加/全选/批量打标/删除选中）与
 * 分页的素材卡片网格（图片+提示词，含单张打标与删除）。
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Checkbox, Col, Empty, Image, Input, message, Modal, Pagination, Row, Spin, Tooltip, Typography,
} from 'antd'
import {
  ArrowLeftOutlined, CopyOutlined, DeleteOutlined, PlusOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { batchApi, type DatasetItem } from '../services/api'
import ReverseConfigFields from '../components/ReverseConfigFields'
import { DEFAULT_REVERSE_CONFIG, type ReverseConfig } from '../constants/reverseOptions'
import { useI18n } from '../i18n'

const { Title, Text } = Typography
const PAGE_SIZE = 12

interface Props {
  datasetName: string
}

const DatasetDetailView: React.FC<Props> = ({ datasetName }) => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [config, setConfig] = useState<ReverseConfig>(DEFAULT_REVERSE_CONFIG)
  const [items, setItems] = useState<DatasetItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagging, setTagging] = useState<Set<string>>(new Set())
  const [batchTagging, setBatchTagging] = useState(false)
  const [deleteFilenames, setDeleteFilenames] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDetail = async (p: number) => {
    setLoading(true)
    try {
      const res = await batchApi.getDataset(datasetName, p, PAGE_SIZE)
      const d = res.data
      setConfig({
        reverseTarget: d.config.reverse_target,
        targetLength: d.config.target_length,
        reverseStyle: d.config.reverse_style,
        outputLanguage: d.config.output_language,
      })
      setItems(d.items)
      setTotal(d.total)
      setPage(d.page)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
    loadDetail(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetName])

  const handlePageChange = (p: number) => {
    setPage(p)
    loadDetail(p)
  }

  // ─── 配置 / config ──────────────────────────────────────────────
  const handleConfigChange = (next: ReverseConfig) => {
    setConfig(next)
    batchApi
      .updateConfig(datasetName, {
        reverse_target: next.reverseTarget,
        target_length: next.targetLength ?? 500,
        reverse_style: next.reverseStyle,
        output_language: next.outputLanguage,
      })
      .catch(() => message.error(t('batch.saveConfigFailed')))
  }

  // ─── 选择 / selection ───────────────────────────────────────────
  const allPageSelected = items.length > 0 && items.every((it) => selected.has(it.filename))
  const toggleSelectAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      items.forEach((it) => (checked ? next.add(it.filename) : next.delete(it.filename)))
      return next
    })
  }
  const toggleSelect = (filename: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(filename)
      else next.delete(filename)
      return next
    })
  }

  // ─── 添加素材 / add items ───────────────────────────────────────
  const handleAddFiles = async (files: File[]) => {
    if (!files.length) return
    setAdding(true)
    try {
      const res = await batchApi.addItems(datasetName, files)
      const { added, duplicates } = res.data
      if (duplicates?.length) message.warning(t('batch.skippedDuplicates').replace('{n}', String(duplicates.length)))
      if (added?.length) message.success(t('batch.added').replace('{n}', String(added.length)))
      loadDetail(page)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.addFailed'))
    } finally {
      setAdding(false)
    }
  }

  // ─── 删除 / delete ──────────────────────────────────────────────
  const doDelete = async (filenames: string[]) => {
    try {
      const res = await batchApi.deleteItems(datasetName, filenames)
      const deleted = res.data.deleted || []
      const failed = res.data.failed || []
      if (deleted.length) {
        message.success(t('batch.deletedItems').replace('{n}', String(deleted.length)))
      }
      if (failed.length) {
        message.warning(t('batch.failedItems').replace('{n}', String(failed.length)))
      }
      setSelected(new Set())
      const newTotal = Math.max(0, total - deleted.length)
      const newPage = Math.max(1, Math.min(page, Math.ceil(newTotal / PAGE_SIZE) || 1))
      setPage(newPage)
      loadDetail(newPage)
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.deleteFailed'))
    }
  }

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success(t('common.copied'))
  }

  const confirmDeleteOne = (filename: string) => {
    setDeleteFilenames([filename])
  }

  const confirmDeleteSelected = () => {
    const filenames = Array.from(selected)
    if (!filenames.length) {
      message.warning(t('batch.selectFirst'))
      return
    }
    setDeleteFilenames(filenames)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteFilenames) return
    const filenames = deleteFilenames
    setDeleting(true)
    try {
      await doDelete(filenames)
      setDeleteFilenames(null)
    } finally {
      setDeleting(false)
    }
  }

  // ─── 打标 / tagging ─────────────────────────────────────────────
  const tagOne = async (filename: string) => {
    setTagging((prev) => new Set(prev).add(filename))
    try {
      const res = await batchApi.tagItem(datasetName, filename)
      setItems((prev) =>
        prev.map((it) => (it.filename === filename ? { ...it, prompt_text: res.data.prompt_text } : it)),
      )
      message.success(t('batch.tagged'))
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('batch.tagFailed'))
    } finally {
      setTagging((prev) => {
        const next = new Set(prev)
        next.delete(filename)
        return next
      })
    }
  }

  const batchTag = async () => {
    const filenames = Array.from(selected)
    if (!filenames.length) {
      message.warning(t('batch.selectFirst'))
      return
    }
    setBatchTagging(true)
    let done = 0
    try {
      await batchApi.tagItems(datasetName, filenames, (item) => {
        if (item.error) {
          message.error(t('batch.tagFailed') + ' ' + item.filename + ': ' + item.error)
          return
        }
        done += 1
        setItems((prev) =>
          prev.map((it) =>
            it.filename === item.filename && item.result ? { ...it, prompt_text: item.result } : it,
          ),
        )
      })
      message.success(t('batch.batchTagDone').replace('{n}', String(done)))
    } catch (e: any) {
      message.error(t('batch.batchTagFailed') + ': ' + (e.message || ''))
    } finally {
      setBatchTagging(false)
    }
  }

  // ─── 素材卡片 / item card ───────────────────────────────────────
  const renderItemCard = (item: DatasetItem) => {
    const isSelected = selected.has(item.filename)
    const isTagging = tagging.has(item.filename)
    return (
      <Card size="small" styles={{ body: { padding: 0 } }} style={{ height: '100%' }}>
        <div style={{ position: 'relative', background: '#fafafa' }}>
          {/* 缩略图：完整展示（contain）+ 点击放大预览 / thumbnail: full (contain) + click to preview */}
          <Image
            src={batchApi.imageUrl(datasetName, item.filename)}
            alt={item.filename}
            width="100%"
            height={170}
            style={{ objectFit: 'contain', display: 'block' }}
          />
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <Checkbox
              checked={isSelected}
              onChange={(e) => toggleSelect(item.filename, e.target.checked)}
              style={{ background: 'rgba(255,255,255,0.85)', padding: 4, borderRadius: 4 }}
            />
          </div>
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
            <Tooltip title={t('batch.tag')}>
              <Button
                size="small"
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={isTagging}
                onClick={() => tagOne(item.filename)}
              />
            </Tooltip>
            <Tooltip title={t('common.delete')}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => confirmDeleteOne(item.filename)}
              />
            </Tooltip>
          </div>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {item.filename}
          </Text>
          {isTagging ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>{t('batch.tagging')}</Text>
            </div>
          ) : item.prompt_text ? (
            <div style={{ marginTop: 4 }}>
              <Input.TextArea
                value={item.prompt_text}
                readOnly
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ fontSize: 12 }}
              />
              <Button
                size="small"
                icon={<CopyOutlined />}
                style={{ marginTop: 4 }}
                onClick={() => copyPrompt(item.prompt_text!)}
              >
                {t('common.copy')}
              </Button>
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('batch.notTagged')}
            </Text>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/batch')}>
          {t('common.back')}
        </Button>
        <Title level={3} style={{ margin: 0 }}>{datasetName}</Title>
        <Text type="secondary">{total} {t('batch.images')}</Text>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <ReverseConfigFields value={config} onChange={handleConfigChange} />
        </Col>

        <Col xs={24} lg={18}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) handleAddFiles(files)
                  e.target.value = ''
                }}
              />
              <Button
                icon={<PlusOutlined />}
                loading={adding}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('batch.addItems')}
              </Button>

              <Checkbox checked={allPageSelected} onChange={(e) => toggleSelectAll(e.target.checked)}>
                {t('batch.selectAll')}
              </Checkbox>

              <Button
                icon={<ThunderboltOutlined />}
                loading={batchTagging}
                disabled={selected.size === 0}
                onClick={batchTag}
              >
                {t('batch.batchTag')}{selected.size > 0 ? `(${selected.size})` : ''}
              </Button>

              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selected.size === 0}
                onClick={confirmDeleteSelected}
              >
                {t('batch.deleteSelected')}{selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </Card>

          <Spin spinning={loading}>
            {items.length === 0 ? (
              <Empty description={t('batch.noItems')} />
            ) : (
              <Row gutter={[16, 16]}>
                {items.map((item) => (
                  <Col key={item.filename} xs={24} sm={12} md={8} lg={6}>
                    {renderItemCard(item)}
                  </Col>
                ))}
              </Row>
            )}
          </Spin>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              showSizeChanger={false}
              hideOnSinglePage
              onChange={handlePageChange}
            />
          </div>
        </Col>
      </Row>

      {/* 删除确认弹窗 / Delete confirmation modal */}
      <Modal
        title={deleteFilenames && deleteFilenames.length > 1
          ? t('batch.deleteSelectedConfirmTitle').replace('{n}', String(deleteFilenames.length))
          : t('batch.deleteItemConfirmTitle')}
        open={deleteFilenames !== null}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
        onOk={handleDeleteConfirm}
        onCancel={() => setDeleteFilenames(null)}
      >
        <p>{t('batch.deleteItemConfirmContent')}</p>
      </Modal>
    </div>
  )
}

export default DatasetDetailView
