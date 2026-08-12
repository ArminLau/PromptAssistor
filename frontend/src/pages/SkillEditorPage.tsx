/**
 * F5: Skill维护 (Skill Editor)
 */

import React, { useEffect, useState } from 'react'
import { Card, List, Button, Typography, message, Modal, Input, Space, Tag } from 'antd'
import { EditOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { skillApi, SkillInfo } from '../services/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const SkillEditorPage: React.FC = () => {
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
      message.error('加载失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const handleViewSkill = async (name: string) => {
    try {
      const response = await skillApi.get(name)
      if (response.data.success) {
        setSelectedSkill(response.data.skill)
      }
    } catch (err: any) {
      message.error('加载Skill详情失败')
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
      message.success('Skill自定义保存成功')
      setEditModalOpen(false)
      loadSkills()
    } catch (err: any) {
      message.error('保存失败: ' + (err.message || '未知错误'))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>Skill 维护</Title>
          <Text type="secondary">查看和自定义各模型的提示词编写指南</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadSkills}>
          刷新列表
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {/* Skill List */}
        <Card title="已安装的 Skills" style={{ flex: 1 }}>
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
                    查看
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
                    自定义
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {skill.display_name}
                      <Tag color="blue">v{skill.version}</Tag>
                      {skill.has_override && <Tag color="orange">已自定义</Tag>}
                    </Space>
                  }
                  description={skill.description}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Skill Detail */}
        {selectedSkill && (
          <Card title={`${selectedSkill.display_name} - 详细内容`} style={{ flex: 2 }}>
            <Paragraph>
              <strong>类型:</strong> {selectedSkill.type} &nbsp;
              <strong>版本:</strong> {selectedSkill.version} &nbsp;
              <strong>作者:</strong> {selectedSkill.author}
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
              {selectedSkill.override_content || selectedSkill.content || '加载中...'}
            </div>
          </Card>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        title="自定义 Skill"
        open={editModalOpen}
        onOk={handleSaveOverride}
        onCancel={() => setEditModalOpen(false)}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>修改说明:</Text>
          <Input
            placeholder="简要描述你的修改内容和目的（例如：适配婚纱摄影行业）"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <Text>Skill 内容 (Markdown):</Text>
          <TextArea
            rows={15}
            value={editContent || selectedSkill?.content || ''}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="在此编辑 Skill 的 Markdown 内容..."
          />
        </Space>
      </Modal>
    </div>
  )
}

export default SkillEditorPage
