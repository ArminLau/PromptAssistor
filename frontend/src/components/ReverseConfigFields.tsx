/**
 * 反推配置字段组件 / Reverse-config fields component.
 *
 * Renders the four reverse-engineering options (target / length / style /
 * language) as a vertical stack, used by the batch-tagging dataset page's
 * left configuration panel. Shares the same option constants as the reverse page.
 * / 渲染四个反推选项（目标/长度/风格/语言）为纵向堆叠，用于批量打标数据集页的左侧配置面板，
 * 与反推页共用同一套选项常量。
 */

import React from 'react'
import { Card, Input, InputNumber, Select, Typography } from 'antd'
import {
  getOutputLanguages,
  getReverseStyles,
  getReverseTargetOptions,
  type ReverseConfig,
} from '../constants/reverseOptions'
import { useI18n } from '../i18n'

const { Text } = Typography

interface Props {
  value: ReverseConfig
  onChange: (next: ReverseConfig) => void
}

const ReverseConfigFields: React.FC<Props> = ({ value, onChange }) => {
  const { t, language } = useI18n()
  const patch = (partial: Partial<ReverseConfig>) => onChange({ ...value, ...partial })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={t('reverse.target')} size="small">
        <Select
          value={value.reverseTarget}
          onChange={(v) => patch({ reverseTarget: v })}
          style={{ width: '100%' }}
          options={getReverseTargetOptions(language)}
        />
      </Card>

      <Card title={t('reverse.length')} size="small">
        <InputNumber
          min={50}
          max={10000}
          step={1}
          precision={0}
          value={value.targetLength}
          onChange={(v) => patch({ targetLength: v })}
          addonAfter={t('reverse.chars')}
          style={{ width: '100%' }}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          {t('reverse.lengthRange')}
        </Text>
      </Card>

      <Card title={t('reverse.style')} size="small">
        <Select
          value={value.reverseStyle}
          onChange={(v) => patch({ reverseStyle: v })}
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

      <Card title={t('reverse.outputLanguage')} size="small">
        <Select
          value={value.outputLanguage}
          onChange={(v) => patch({ outputLanguage: v })}
          style={{ width: '100%' }}
          options={getOutputLanguages(language)}
        />
      </Card>

      <Card title={t('reverse.requirements')} size="small">
        <Input.TextArea
          rows={3}
          placeholder={t('reverse.requirementsPlaceholder')}
          value={value.requirement}
          onChange={(e) => patch({ requirement: e.target.value })}
          maxLength={2000}
          showCount
        />
      </Card>
    </div>
  )
}

export default ReverseConfigFields
