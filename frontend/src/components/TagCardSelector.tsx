/**
 * F6: 参考标签选择器 / Reference-tag selector.
 *
 * Two-part selector: (1) a tag input box that fuzzy-matches tag names in a
 * dropdown, plus a button opening a tag-picker dialog (a large modal showing
 * the category tree on the left and tag cards with preview images on the right,
 * so the user can see what each tag looks like before selecting); (2) a
 * selected-tags bar showing each selected tag as a card displaying only the
 * first 5 characters of the name, with a hover tooltip revealing the full name,
 * content, note and preview image.
 * / 两部分选择器：(1) 标签输入框（模糊匹配下拉），加一个打开标签选择对话框的按钮——该对话框
 * 为一个大弹窗，左侧分类树、右侧带预览图的标签卡片，让用户看清每个标签的样子再选；
 * (2) 已选标签栏，每个标签以卡片展示，仅显示名称前 5 个字符，悬浮 tooltip 展示完整名称、
 * 内容、备注与预览图。
 */

import React, { useMemo, useState } from 'react'
import {
  AutoComplete, Button, Empty, Image, Modal, Tooltip, Tree, Typography,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  ApartmentOutlined, CheckOutlined, CloseOutlined, FileImageOutlined,
} from '@ant-design/icons'
import { labelsApi, type LabelNode, type LabelTag } from '../services/api'
import { useI18n } from '../i18n'

const { Text } = Typography

/** 已选标签 / A selected tag (key = `${path}/${name}`) */
export interface SelectedTag {
  key: string
  path: string
  name: string
  content: string
  note: string
  has_preview: boolean
}

interface Props {
  tree: LabelNode[]
  visibleFirsts: string[]      // 按生成目标范围显示的一级分类 / first-level categories to show by scope
  selected: SelectedTag[]
  onChange: (tags: SelectedTag[]) => void
}

// 扁平化的标签（用于模糊匹配与按 key 反查）/ flattened tag for fuzzy matching and lookup
interface FlatTag {
  path: string
  name: string
  content: string
  note: string
  has_preview: boolean
}

const keyOf = (path: string, name: string) => `${path}/${name}`

const shortName = (name: string) => {
  const chars = Array.from(name)
  return chars.length > 5 ? chars.slice(0, 5).join('') + '…' : name
}

const findNode = (nodes: LabelNode[], path: string): LabelNode | null => {
  for (const n of nodes) {
    if (n.path === path) return n
    const found = findNode(n.children, path)
    if (found) return found
  }
  return null
}

const TagCardSelector: React.FC<Props> = ({ tree, visibleFirsts, selected, onChange }) => {
  const { t } = useI18n()

  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPath, setPickerPath] = useState('')

  // 可见的根节点 / visible root nodes
  const visibleRoots = useMemo(
    () => tree.filter((n) => visibleFirsts.includes(n.name)),
    [tree, visibleFirsts],
  )

  // 扁平化所有可见标签 / flatten all visible tags
  const flatTags: FlatTag[] = useMemo(() => {
    const out: FlatTag[] = []
    const walk = (nodes: LabelNode[]) => {
      for (const n of nodes) {
        for (const tag of n.tags) {
          out.push({ path: n.path, name: tag.name, content: tag.content, note: tag.note, has_preview: tag.has_preview })
        }
        walk(n.children)
      }
    }
    walk(visibleRoots)
    return out
  }, [visibleRoots])

  const flatMap = useMemo(() => {
    const m = new Map<string, FlatTag>()
    for (const t of flatTags) m.set(keyOf(t.path, t.name), t)
    return m
  }, [flatTags])

  // 模糊匹配下拉选项 / fuzzy-match dropdown options
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return flatTags
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 50)
      .map((t) => ({ value: keyOf(t.path, t.name), label: `${t.name} · ${t.path}` }))
  }, [query, flatTags])

  const addByKey = (key: string) => {
    const tag = flatMap.get(key)
    if (!tag) return
    if (selected.some((s) => s.key === key)) return
    onChange([
      ...selected,
      { key, path: tag.path, name: tag.name, content: tag.content, note: tag.note, has_preview: tag.has_preview },
    ])
  }

  const remove = (key: string) => onChange(selected.filter((s) => s.key !== key))

  const toggle = (path: string, tag: LabelTag) => {
    const key = keyOf(path, tag.name)
    if (selected.some((s) => s.key === key)) {
      remove(key)
    } else {
      onChange([
        ...selected,
        { key, path, name: tag.name, content: tag.content, note: tag.note, has_preview: tag.has_preview },
      ])
    }
  }

  // 打开选择器时默认选中第一个可见根分类 / default to the first visible root when opening
  const openPicker = () => {
    setPickerPath(visibleRoots[0]?.path ?? '')
    setPickerOpen(true)
  }

  // 分类树数据（仅分类节点，右侧展示标签）/ category tree data (categories only)
  const toCategoryTreeData = (nodes: LabelNode[]): DataNode[] =>
    nodes.map((n) => ({
      key: n.path,
      title: n.name,
      children: toCategoryTreeData(n.children),
    }))

  const pickerNode = findNode(visibleRoots, pickerPath)
  const pickerTags: LabelTag[] = pickerNode?.tags ?? []

  const tooltipContent = (tag: SelectedTag) => (
    <div style={{ maxWidth: 260 }}>
      <div style={{ fontWeight: 600 }}>{tag.name}</div>
      {tag.has_preview && (
        <img
          src={labelsApi.previewUrl(tag.path, tag.name)}
          alt={tag.name}
          style={{ maxWidth: 120, maxHeight: 120, objectFit: 'contain', margin: '4px 0', display: 'block' }}
        />
      )}
      {tag.content && <div style={{ fontSize: 12, marginTop: 4 }}>{tag.content}</div>}
      {tag.note && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{tag.note}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 第一部分：输入框 + 选择对话框按钮 / part 1: input + picker dialog button */}
      <div style={{ display: 'flex', gap: 8 }}>
        <AutoComplete
          value={query}
          onChange={setQuery}
          onSelect={(val) => { addByKey(String(val)); setQuery('') }}
          options={options}
          filterOption={false}
          placeholder={t('generate.tagInputPlaceholder')}
          style={{ flex: 1 }}
          allowClear
        />
        <Button icon={<ApartmentOutlined />} onClick={openPicker}>
          {t('generate.tagPicker')}
        </Button>
      </div>

      {/* 第二部分：已选标签栏 / part 2: selected tags bar */}
      {selected.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>{t('generate.tagsEmpty')}</Text>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selected.map((tag) => (
            <Tooltip key={tag.key} title={tooltipContent(tag)} placement="top">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  border: '1px solid #1677ff',
                  borderRadius: 6,
                  background: '#e6f4ff',
                  cursor: 'default',
                }}
              >
                <Text style={{ fontSize: 12 }}>{shortName(tag.name)}</Text>
                <CloseOutlined
                  style={{ fontSize: 10, color: '#1677ff', cursor: 'pointer' }}
                  onClick={() => remove(tag.key)}
                />
              </div>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 标签选择对话框 / tag picker dialog */}
      <Modal
        title={t('generate.tagPicker')}
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        footer={null}
        width={820}
      >
        {visibleRoots.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('labels.noTags')} />
        ) : (
          <div style={{ display: 'flex', gap: 16, minHeight: 360 }}>
            {/* 左侧：分类树 / left: category tree */}
            <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
              <Tree
                treeData={toCategoryTreeData(visibleRoots)}
                selectedKeys={pickerPath ? [pickerPath] : []}
                defaultExpandedKeys={visibleRoots.map((n) => n.path)}
                onSelect={(keys) => {
                  if (keys.length > 0) setPickerPath(String(keys[0]))
                }}
              />
            </div>

            {/* 右侧：标签卡片（带预览图）/ right: tag cards (with preview) */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {pickerTags.length === 0 ? (
                <Empty description={t('labels.noTags')} />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {pickerTags.map((tag) => {
                    const key = keyOf(pickerPath, tag.name)
                    const isSel = selected.some((s) => s.key === key)
                    return (
                      <Tooltip
                        key={key}
                        placement="top"
                        title={
                          <div style={{ maxWidth: 240 }}>
                            <div style={{ fontWeight: 600 }}>{tag.name}</div>
                            {tag.has_preview && (
                              <img
                                src={labelsApi.previewUrl(pickerPath, tag.name)}
                                alt={tag.name}
                                style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain', margin: '4px 0', display: 'block' }}
                              />
                            )}
                            {tag.content && <div style={{ fontSize: 12, marginTop: 4 }}>{tag.content}</div>}
                            {tag.note && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{tag.note}</div>}
                          </div>
                        }
                      >
                        <div
                          onClick={() => toggle(pickerPath, tag)}
                          style={{
                            width: 108,
                            border: isSel ? '2px solid #1677ff' : '1px solid #e5e5e5',
                            borderRadius: 8,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: isSel ? '#e6f4ff' : '#fff',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              height: 108,
                              width: '100%',
                              background: '#fafafa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {tag.has_preview ? (
                              <Image
                                src={labelsApi.previewUrl(pickerPath, tag.name)}
                                alt={tag.name}
                                width="100%"
                                height={108}
                                style={{ objectFit: 'contain' }}
                                preview={false}
                              />
                            ) : (
                              <FileImageOutlined style={{ fontSize: 28, color: '#ccc' }} />
                            )}
                          </div>
                          <div style={{ padding: '4px 6px' }}>
                            <Text style={{ fontSize: 12 }} ellipsis>{tag.name}</Text>
                          </div>
                          {isSel && (
                            <CheckOutlined
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                color: '#1677ff',
                                fontSize: 14,
                              }}
                            />
                          )}
                        </div>
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TagCardSelector
