/**
 * F5: Skill维护 (Skill Editor)
 * / Skill Editor — view and customize model prompt-writing guides.
 */

import React, { useEffect, useState } from 'react'
import { Card, List, Button, Typography, message, Modal, Input, Space, Tag } from 'antd'
import { EditOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { skillApi, SkillInfo } from '../services/api'
import { useI18n } from '../i18n'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const SkillEditorPage: React.FC = () => {
  const { t } = useI18n()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<any>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const loadSkills = async () => {
    setLoading(true)
    try {
      const response = await skillApi.list()
      if (response.data.success) {
        setSkills(response.data.skills || [])
      }
    } catch (err: any) {
      message.error(t('skills.loadFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSkills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleViewSkill = async (name: string) => {
    try {
      const response = await skillApi.get(name)
      if (response.data.success) {
        setSelectedSkill(response.data.skill)
      }
    } catch (err: any) {
      message.error(t('skills.loadDetailFailed'))
    }
  }

  const handleSaveOverride = async () => {
    if (!selectedSkill) return
    try {
      await skillApi.saveOverride(selectedSkill.name, {
        skill_name: selectedSkill.name,
        override_content: editContent,
        description: editDescription,
      })
      message.success(t('skills.saved'))
      setEditModalOpen(false)
      loadSkills()
    } catch (err: any) {
      message.error(t('skills.saveFailed') + ': ' + (err.message || t('common.unknownError')))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>{t('skills.title')}</Title>
          <Text type="secondary">{t('skills.description')}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadSkills}>
          {t('skills.refresh')}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* Skill List / Skill列表 */}
        <Card title={t('skills.installed')} style={{ flex: 1 }}>
          <List
            loading={loading}
            dataSource={skills}
            renderItem={(skill) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewSkill(skill.name)}
                  >
                    {t('skills.view')}
                  </Button>,
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => {
                      handleViewSkill(skill.name).then(() => {
                        setEditContent('')
                        setEditDescription('')
                        setEditModalOpen(true)
                      })
                    }}
                  >
                    {t('skills.customize')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {skill.display_name}
                      <Tag color="blue">v{skill.version}</Tag>
                      {skill.has_override && <Tag color="orange">{t('skills.customized')}</Tag>}
                    </Space>
                  }
                  description={skill.description}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Skill Detail / Skill详情 */}
        {selectedSkill && (
          <Card title={`${selectedSkill.display_name} - ${t('skills.detail')}`} style={{ flex: 2 }}>
            <Paragraph>
              <strong>{t('skills.type')}:</strong> {selectedSkill.type} &nbsp;
              <strong>{t('skills.version')}:</strong> {selectedSkill.version} &nbsp;
              <strong>{t('skills.author')}:</strong> {selectedSkill.author}
            </Paragraph>
            <div
              style={{
                background: '#f6f8fa',
                padding: 16,
                borderRadius: 8,
                maxHeight: 500,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            >
              {selectedSkill.override_content || selectedSkill.content || t('common.loading')}
            </div>
          </Card>
        )}
      </div>

      {/* Edit Modal / 编辑弹窗 */}
      <Modal
        title={t('skills.customizeSkill')}
        open={editModalOpen}
        onOk={handleSaveOverride}
        onCancel={() => setEditModalOpen(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{t('skills.editDesc')}:</Text>
          <Input
            placeholder={t('skills.editDescPlaceholder')}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <Text>{t('skills.contentLabel')}:</Text>
          <TextArea
            rows={15}
            value={editContent || selectedSkill?.content || ''}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder={t('skills.contentPlaceholder')}
          />
        </Space>
      </Modal>
    </div>
  )
}

export default SkillEditorPage
