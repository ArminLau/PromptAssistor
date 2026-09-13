/**
 * F6: 标签管理抽屉 / Label Manager Drawer.
 *
 * Full-screen drawer for maintaining the reference-tag library. The left side
 * shows the category tree (arbitrary depth; the two first-level roots 自然语言 /
 * Danbooru标签 are fixed) with per-node add/rename/delete actions; the right
 * side shows the selected category's tag cards. A tag's preview image only
 * opens the image preview; editing is triggered by the pencil button next to
 * the name, and deletion by the trash button.
 * / 维护参考标签库的全屏抽屉。左侧为分类树（任意深度；两个一级根 自然语言/Danbooru标签
 * 固定），每个节点可增/改/删；右侧为选中分类的标签卡片。标签预览图点击仅放大预览；
 * 名称右侧的铅笔按钮触发编辑，垃圾桶按钮触发删除。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Button, Drawer, Empty, Image, Input, message, Modal, Spin, Tree, Typography,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  DeleteOutlined, EditOutlined, FileImageOutlined, PlusOutlined, ReloadOutlined, TagOutlined,
} from '@ant-design/icons'
import { labelsApi, type LabelNode, type LabelTag } from '../services/api'
import { useI18n } from '../i18n'

const { Text } = Typography

interface Props {
  open: boolean
  onClose: () => void
}

// 标签编辑弹窗的状态 / tag editor modal state
interface TagEditorState {
  mode: 'create' | 'edit'
  path: string
  originalName: string
  name: string
  content: string
  note: string
}

// 判断是否是一级根分类（路径不含 `/`）/ whether a path is a first-level root
const isRoot = (path: string) => !path.includes('/')

const LabelManagerDrawer: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n()

  const [tree, setTree] = useState<LabelNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['自然语言', 'Danbooru标签'])

  // 分类弹窗状态 / category modal states
  const [catCreateParent, setCatCreateParent] = useState<string | null>(null)
  const [catCreateName, setCatCreateName] = useState('')
  const [catRenameTarget, setCatRenameTarget] = useState<LabelNode | null>(null)
  const [catRenameName, setCatRenameName] = useState('')
  const [catDeleteTarget, setCatDeleteTarget] = useState<LabelNode | null>(null)
  const [catBusy, setCatBusy] = useState(false)

  // 标签弹窗状态 / tag modal states
  const [tagEditor, setTagEditor] = useState<TagEditorState | null>(null)
  const [tagDeleteTarget, setTagDeleteTarget] = useState<LabelTag | null>(null)
  const [tagBusy, setTagBusy] = useState(false)

  const loadTree = async () => {
    setLoading(true)
    try {
      const res = await labelsApi.tree()
      setTree(res.data.tree || [])
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 按路径查找节点 / find a node by path
  const findNode = (nodes: LabelNode[], path: string): LabelNode | null => {
    for (const n of nodes) {
      if (n.path === path) return n
      const found = findNode(n.children, path)
      if (found) return found
    }
    return null
  }

  const selectedNode = useMemo(() => findNode(tree, selectedPath), [tree, selectedPath])
  const tags: LabelTag[] = selectedNode?.tags ?? []

  // 首次加载后自动选中第一个根分类 / auto-select the first root after load
  useEffect(() => {
    if (!selectedPath && tree.length > 0) {
      setSelectedPath(tree[0].path)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree])

  // ─── 分类 CRUD / category CRUD ───────────────────────────────────────────
  const openCatCreate = (parentPath: string) => {
    setCatCreateParent(parentPath)
    setCatCreateName('')
  }

  const handleCatCreate = async () => {
    if (!catCreateParent) return
    const name = catCreateName.trim()
    if (!name) {
      message.warning(t('labels.enterCategoryName'))
      return
    }
    setCatBusy(true)
    try {
      await labelsApi.createCategory(catCreateParent, name)
      message.success(t('labels.categoryCreated'))
      setCatCreateParent(null)
      await loadTree()
      setExpandedKeys((prev) => Array.from(new Set([...prev, catCreateParent])))
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.categoryCreateFailed'))
    } finally {
      setCatBusy(false)
    }
  }

  const handleCatRename = async () => {
    if (!catRenameTarget) return
    const name = catRenameName.trim()
    if (!name) {
      message.warning(t('labels.enterCategoryName'))
      return
    }
    if (name === catRenameTarget.name) {
      setCatRenameTarget(null)
      return
    }
    setCatBusy(true)
    try {
      await labelsApi.renameCategory(catRenameTarget.path, name)
      message.success(t('labels.categoryRenamed'))
      const oldPath = catRenameTarget.path
      const newPath = oldPath.split('/').slice(0, -1).concat(name).join('/')
      setCatRenameTarget(null)
      await loadTree()
      setSelectedPath((prev) =>
        prev === oldPath || prev.startsWith(oldPath + '/')
          ? newPath + prev.slice(oldPath.length)
          : prev,
      )
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.categoryRenameFailed'))
    } finally {
      setCatBusy(false)
    }
  }

  const handleCatDelete = async () => {
    if (!catDeleteTarget) return
    setCatBusy(true)
    try {
      await labelsApi.deleteCategory(catDeleteTarget.path)
      message.success(t('labels.categoryDeleted'))
      const oldPath = catDeleteTarget.path
      setCatDeleteTarget(null)
      await loadTree()
      setSelectedPath((prev) =>
        prev === oldPath || prev.startsWith(oldPath + '/') ? '' : prev,
      )
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.categoryDeleteFailed'))
    } finally {
      setCatBusy(false)
    }
  }

  // ─── 标签 CRUD / tag CRUD ────────────────────────────────────────────────
  const openTagEditor = (mode: 'create' | 'edit', tag?: LabelTag) => {
    if (mode === 'create' && !selectedPath) return
    setTagEditor({
      mode,
      path: selectedPath,
      originalName: tag?.name ?? '',
      name: tag?.name ?? '',
      content: tag?.content ?? '',
      note: tag?.note ?? '',
    })
  }

  const handleTagSave = async () => {
    if (!tagEditor) return
    const name = tagEditor.name.trim()
    if (!name) {
      message.warning(t('labels.enterTagName'))
      return
    }
    setTagBusy(true)
    try {
      if (tagEditor.mode === 'create') {
        await labelsApi.createTag({
          path: tagEditor.path,
          name,
          content: tagEditor.content,
          note: tagEditor.note,
        })
        message.success(t('labels.tagCreated'))
      } else {
        await labelsApi.updateTag(tagEditor.path, tagEditor.originalName, {
          name,
          content: tagEditor.content,
          note: tagEditor.note,
        })
        message.success(t('labels.tagSaved'))
      }
      setTagEditor(null)
      await loadTree()
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.tagSaveFailed'))
    } finally {
      setTagBusy(false)
    }
  }

  const handleTagDelete = async () => {
    if (!tagDeleteTarget) return
    setTagBusy(true)
    try {
      await labelsApi.deleteTag(selectedPath, tagDeleteTarget.name)
      message.success(t('labels.tagDeleted'))
      setTagDeleteTarget(null)
      await loadTree()
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.tagDeleteFailed'))
    } finally {
      setTagBusy(false)
    }
  }

  // 构建分类树数据（antd Tree）/ build category tree data (antd Tree)
  const toTreeData = (nodes: LabelNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.path,
      title: (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
        >
          <Text style={{ fontSize: 13 }} ellipsis>{n.name}</Text>
          <span
            style={{ display: 'flex', gap: 0, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={() => openCatCreate(n.path)}
            />
            {!isRoot(n.path) && (
              <>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => { setCatRenameTarget(n); setCatRenameName(n.name) }}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setCatDeleteTarget(n)}
                />
              </>
            )}
          </span>
        </div>
      ),
      children: toTreeData(n.children),
    }))

  const renderTagCard = (tag: LabelTag) => (
    <div
      key={tag.name}
      style={{
        width: 120,
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* 预览图：点击仅放大预览 / preview: click only zooms the image */}
      <div
        style={{
          height: 120,
          width: '100%',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {tag.has_preview ? (
          <Image
            src={labelsApi.previewUrl(selectedPath, tag.name)}
            alt={tag.name}
            width="100%"
            height={120}
            style={{ objectFit: 'contain' }}
            preview={{ mask: null }}
          />
        ) : (
          <FileImageOutlined style={{ fontSize: 32, color: '#ccc' }} />
        )}
      </div>
      {/* 名称 + 编辑/删除按钮 / name + edit/delete buttons */}
      <div
        style={{
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 12 }} ellipsis>{tag.name}</Text>
        <span style={{ display: 'flex', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openTagEditor('edit', tag)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setTagDeleteTarget(tag)}
          />
        </span>
      </div>
    </div>
  )

  return (
    <Drawer
      title={t('labels.title')}
      open={open}
      onClose={onClose}
      width={960}
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadTree}>
          {t('common.refresh')}
        </Button>
      }
    >
      <Spin spinning={loading}>
        <div style={{ display: 'flex', gap: 16, minHeight: 480 }}>
          {/* 左侧：分类树 / left: category tree */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
              <Button
                block
                size="small"
                icon={<PlusOutlined />}
                disabled={!selectedPath}
                onClick={() => selectedPath && openCatCreate(selectedPath)}
              >
                {t('labels.addSubCategory')}
              </Button>
            </div>
            {tree.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('labels.noCategories')} />
            ) : (
              <Tree
                treeData={toTreeData(tree)}
                selectedKeys={selectedPath ? [selectedPath] : []}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onSelect={(keys) => {
                  if (keys.length > 0) setSelectedPath(String(keys[0]))
                }}
              />
            )}
          </div>

          {/* 右侧：标签卡片 / right: tag cards */}
          <div style={{ flex: 1 }}>
            {selectedNode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <TagOutlined />
                  <Text strong>{selectedNode.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>({tags.length})</Text>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openTagEditor('create')}
                    style={{ marginLeft: 'auto' }}
                  >
                    {t('labels.addTag')}
                  </Button>
                </div>
                {tags.length === 0 ? (
                  <Empty description={t('labels.noTags')} />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {tags.map(renderTagCard)}
                  </div>
                )}
              </>
            ) : (
              <Empty description={t('labels.selectCategory')} />
            )}
          </div>
        </div>
      </Spin>

      {/* 新建分类弹窗 / create category modal */}
      <Modal
        title={t('labels.addSubCategory')}
        open={catCreateParent !== null}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        confirmLoading={catBusy}
        onOk={handleCatCreate}
        onCancel={() => setCatCreateParent(null)}
      >
        <Input
          placeholder={t('labels.categoryNamePlaceholder')}
          value={catCreateName}
          onChange={(e) => setCatCreateName(e.target.value)}
          onPressEnter={handleCatCreate}
          maxLength={100}
        />
      </Modal>

      {/* 重命名分类弹窗 / rename category modal */}
      <Modal
        title={t('labels.renameCategory')}
        open={catRenameTarget !== null}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={catBusy}
        onOk={handleCatRename}
        onCancel={() => setCatRenameTarget(null)}
      >
        <Input
          placeholder={t('labels.categoryNamePlaceholder')}
          value={catRenameName}
          onChange={(e) => setCatRenameName(e.target.value)}
          onPressEnter={handleCatRename}
          maxLength={100}
        />
      </Modal>

      {/* 删除分类确认弹窗 / delete category confirmation modal */}
      <Modal
        title={t('labels.deleteCategoryConfirmTitle').replace('{name}', catDeleteTarget?.name ?? '')}
        open={catDeleteTarget !== null}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={catBusy}
        onOk={handleCatDelete}
        onCancel={() => setCatDeleteTarget(null)}
      >
        <p>{t('labels.deleteCategoryConfirmContent')}</p>
      </Modal>

      {/* 新建/编辑标签弹窗 / create/edit tag modal */}
      <Modal
        title={tagEditor?.mode === 'create' ? t('labels.addTag') : t('labels.editTag')}
        open={tagEditor !== null}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={tagBusy}
        onOk={handleTagSave}
        onCancel={() => setTagEditor(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12 }}>{t('labels.name')}</Text>
            <Input
              placeholder={t('labels.namePlaceholder')}
              value={tagEditor?.name ?? ''}
              onChange={(e) => setTagEditor((prev) => prev ? { ...prev, name: e.target.value } : prev)}
              maxLength={200}
            />
          </div>
          <div>
            <Text style={{ fontSize: 12 }}>{t('labels.content')}</Text>
            <Input.TextArea
              placeholder={t('labels.contentPlaceholder')}
              value={tagEditor?.content ?? ''}
              onChange={(e) => setTagEditor((prev) => prev ? { ...prev, content: e.target.value } : prev)}
              rows={4}
              maxLength={2000}
              showCount
            />
          </div>
          <div>
            <Text style={{ fontSize: 12 }}>{t('labels.note')}</Text>
            <Input.TextArea
              placeholder={t('labels.notePlaceholder')}
              value={tagEditor?.note ?? ''}
              onChange={(e) => setTagEditor((prev) => prev ? { ...prev, note: e.target.value } : prev)}
              rows={2}
              maxLength={1000}
            />
          </div>
        </div>
      </Modal>

      {/* 删除标签确认弹窗 / delete tag confirmation modal */}
      <Modal
        title={t('labels.deleteTagConfirmTitle').replace('{name}', tagDeleteTarget?.name ?? '')}
        open={tagDeleteTarget !== null}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={tagBusy}
        onOk={handleTagDelete}
        onCancel={() => setTagDeleteTarget(null)}
      >
        <p>{t('labels.deleteTagConfirmContent')}</p>
      </Modal>
    </Drawer>
  )
}

export default LabelManagerDrawer
