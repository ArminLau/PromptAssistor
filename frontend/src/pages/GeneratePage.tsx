/**
 * F6: 提示词生成 / Prompt Generation page.
 *
 * Compose a professional prompt from a target model, an optional requirement
 * description, and selected reference tags (from the tag library). The tag
 * library is maintained in a drawer opened from the top-right "标签管理" button.
 * / 从目标模型、可选需求描述与选中的参考标签（来自标签库）组合生成专业提示词。
 * 标签库由右上角「标签管理」按钮打开抽屉维护。
 */

import React, { useEffect, useState } from 'react'
import {
  Button, Card, Col, Input, InputNumber, message, Row, Select, Spin, Typography,
} from 'antd'
import {
  CopyOutlined, TagsOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { generateApi, labelsApi, type LabelNode } from '../services/api'
import LabelManagerDrawer from '../components/LabelManagerDrawer'
import TagCardSelector, { type SelectedTag } from '../components/TagCardSelector'
import {
  getOutputLanguages,
  getReverseStyles,
  getReverseTargetOptions,
  parseTarget,
} from '../constants/reverseOptions'
import { useI18n } from '../i18n'

const { Title, Text } = Typography

const GeneratePage: React.FC = () => {
  const { t, language } = useI18n()

  const [target, setTarget] = useState('natural_prompt:krea2')
  const [targetLength, setTargetLength] = useState<number | null>(500)
  const [style, setStyle] = useState('five_point')
  const [outputLanguage, setOutputLanguage] = useState('zh')
  const [requirement, setRequirement] = useState('')

  const [tree, setTree] = useState<LabelNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([])

  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [labelManagerOpen, setLabelManagerOpen] = useState(false)

  const loadTree = async () => {
    setTreeLoading(true)
    try {
      const res = await labelsApi.tree()
      setTree(res.data.tree || [])
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('labels.loadFailed'))
    } finally {
      setTreeLoading(false)
    }
  }

  useEffect(() => {
    loadTree()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 按生成目标计算可见的一级分类 / derive visible first-level categories from the target
  const { skill } = parseTarget(target)
  const visibleFirsts =
    skill === 'natural_prompt'
      ? ['自然语言']
      : skill === 'danbooru_prompt'
        ? ['Danbooru标签']
        : ['自然语言', 'Danbooru标签']

  const handleGenerate = async () => {
    if (!requirement.trim() && selectedTags.length === 0) {
      message.warning(t('generate.needInput'))
      return
    }
    setLoading(true)
    try {
      const res = await generateApi.generate({
        target,
        target_length: targetLength ?? 0,
        style,
        output_language: outputLanguage,
        requirement,
        tags: selectedTags.map((s) => ({ name: s.name, content: s.content })),
      })
      if (res.data.success) {
        setResult(res.data.result ?? '')
        message.success(t('generate.done'))
      } else {
        message.error(res.data.error || t('generate.failed'))
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || t('generate.failed'))
    } finally {
      setLoading(false)
    }
  }

  const copyResult = () => {
    navigator.clipboard.writeText(result)
    message.success(t('common.copied'))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{t('generate.title')}</Title>
          <Text type="secondary">{t('generate.description')}</Text>
        </div>
        <Button icon={<TagsOutlined />} onClick={() => setLabelManagerOpen(true)}>
          {t('generate.tagManager')}
        </Button>
      </div>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 左侧：配置区 / left: config panel */}
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={t('generate.target')} size="small">
              <Select
                value={target}
                onChange={(v) => setTarget(v)}
                style={{ width: '100%' }}
                options={getReverseTargetOptions(language)}
              />
            </Card>

            <Card title={t('generate.length')} size="small">
              <InputNumber
                min={50}
                max={10000}
                step={1}
                precision={0}
                value={targetLength}
                onChange={(v) => setTargetLength(v)}
                addonAfter={t('generate.chars')}
                style={{ width: '100%' }}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                {t('generate.lengthRange')}
              </Text>
            </Card>

            <Card title={t('generate.style')} size="small">
              <Select
                value={style}
                onChange={(v) => setStyle(v)}
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

            <Card title={t('generate.outputLanguage')} size="small">
              <Select
                value={outputLanguage}
                onChange={(v) => setOutputLanguage(v)}
                style={{ width: '100%' }}
                options={getOutputLanguages(language)}
              />
            </Card>

            <Card title={t('generate.requirement')} size="small">
              <Input.TextArea
                rows={5}
                placeholder={t('generate.requirementPlaceholder')}
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                maxLength={2000}
                showCount
              />
            </Card>
          </div>
        </Col>

        {/* 右侧：参考标签 + 结果 / right: reference tags + result */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <span>
                {t('generate.referenceTags')}
                {selectedTags.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    ({selectedTags.length})
                  </Text>
                )}
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Spin spinning={treeLoading}>
              <TagCardSelector
                tree={tree}
                visibleFirsts={visibleFirsts}
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </Spin>
          </Card>

          <Button
            type="primary"
            size="large"
            block
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleGenerate}
            style={{ marginBottom: 16 }}
          >
            {t('generate.generateBtn')}
          </Button>

          <Card title={t('generate.result')} size="small">
            {result ? (
              <div>
                <Input.TextArea
                  value={result}
                  readOnly
                  autoSize={{ minRows: 6, maxRows: 20 }}
                  style={{ fontSize: 13 }}
                />
                <Button
                  icon={<CopyOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={copyResult}
                >
                  {t('common.copy')}
                </Button>
              </div>
            ) : (
              <Text type="secondary">{t('generate.emptyResult')}</Text>
            )}
          </Card>
        </Col>
      </Row>

      <LabelManagerDrawer open={labelManagerOpen} onClose={() => setLabelManagerOpen(false)} />
    </div>
  )
}

export default GeneratePage
