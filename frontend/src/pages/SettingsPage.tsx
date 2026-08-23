/**
 * Settings page — configure LLM providers, workspace, and app preferences.
 * / 设置页面 — 配置LLM后端、工作空间和应用偏好。
 */

import React, { useEffect, useState } from 'react'
import {
  Card, Tabs, Form, Input, InputNumber, Select, Button,
  Switch, Typography, message, Space, Tag, Divider, Alert, Spin,
} from 'antd'
import {
  ApiOutlined, CloudServerOutlined, LaptopOutlined,
  SettingOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FolderOutlined, SaveOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { modelApi, configApi, systemApi } from '../services/api'
import type { AppConfig } from '../types'
import { useI18n } from '../i18n'

const { Title, Text, Paragraph } = Typography

// Types for scanned models / 扫描结果类型
interface ScannedFile {
  name: string; path: string; relative_path: string; size_mb: number; parent_dir?: string
}
interface ScanResult {
  models_dir: string; models: ScannedFile[]; mmproj: ScannedFile[]
  pairs: Array<{ model: ScannedFile; mmproj: ScannedFile }>
}

const SettingsPage: React.FC = () => {
  const { t } = useI18n()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [activeTab, setActiveTab] = useState('online')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [scanned, setScanned] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [appHome, setAppHome] = useState<string>('')
  const [browsingFolder, setBrowsingFolder] = useState(false)

  const [form] = Form.useForm()

  // Load config on mount / 挂载时加载配置
  useEffect(() => {
    loadConfig(true)
    scanModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When switching tabs, update form values / 切换Tab时更新表单值
  useEffect(() => {
    if (config) {
      const providerConfig = config.providers[activeTab as keyof typeof config.providers] || {}
      const wsPath = (config as any).workspace?.path || ''
      form.setFieldsValue({
        ...providerConfig,
        active_provider: config.active_provider,
        // 未设置工作空间时显示app_home作为提示 / Show app_home as hint when no workspace set
        workspace_path: wsPath || '',
        workspace_enabled: (config as any).workspace?.enabled || false,
      })
    }
  }, [activeTab, config, form])

  const loadConfig = async (resetTab = false) => {
    setLoading(true)
    try {
      const resp = await configApi.get()
      setConfig(resp.data as AppConfig)
      // 保存应用主目录（exe所在目录）用于默认工作空间路径 / Save app home for default workspace path
      if ((resp.data as any).app_home) {
        setAppHome((resp.data as any).app_home)
      }
      // 仅在初始加载时设置标签页，保存后刷新时保持当前标签不跳转
      // Only reset tab on initial load; keep current tab when refreshing after save
      if (resetTab && resp.data?.active_provider) {
        setActiveTab(resp.data.active_provider)
      }
    } catch (err: any) {
      message.error(t('settings.loadConfigFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  // Scan models directory / 扫描模型目录
  const scanModels = async () => {
    setScanning(true)
    try {
      const resp = await systemApi.scanModels()
      setScanned(resp.data as ScanResult)
    } catch (err: any) {
      message.error(t('settings.scanFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setScanning(false)
    }
  }

  // 切换到本地模型tab时重新扫描 / Rescan when switching to local tab
  useEffect(() => {
    if (activeTab === 'local') {
      scanModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleSave = async () => {
    setSaving(true)
    try {
      const values = form.getFieldsValue()
      const providerType = activeTab

      // Build update payload / 构建更新数据
      const updateData: Record<string, any> = {}

      // 工作空间Tab不发送 active_provider 和 providers.* 字段
      // Workspace tab: skip active_provider and provider config (not a valid provider type)
      const isProviderTab = ['local', 'online', 'ollama'].includes(providerType)
      if (isProviderTab) {
        updateData['active_provider'] = values.active_provider || providerType

        // Provider-specific config / 各后端配置
        updateData[`providers.${providerType}`] = {
          model_path: values.model_path || '',
          mmproj_path: values.mmproj_path || '',
          n_ctx: values.n_ctx || 32768,
          n_threads: values.n_threads || 8,
          gpu_layers: values.gpu_layers ?? -1,
          temperature: values.temperature ?? 0.7,
          top_p: values.top_p ?? 0.9,
          provider: values.provider || 'deepseek',
          api_key: values.api_key || '',
          api_base: values.api_base || '',
          model_name: values.model_name || '',
          max_tokens: values.max_tokens || 4096,
          host: values.host || 'http://localhost:11434',
        }
      }

      // Workspace config / 工作空间配置
      if (values.workspace_enabled !== undefined) {
        updateData['workspace.enabled'] = values.workspace_enabled
        updateData['workspace.path'] = values.workspace_path || ''
      }

      await configApi.update(updateData)
      await loadConfig() // Reload / 重新加载
      message.success(t('settings.saved'))
    } catch (err: any) {
      message.error(t('settings.saveFailed') + ': ' + (err.message || t('common.unknownError')))
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await modelApi.testProvider(activeTab)
      setTestResult({
        success: resp.data?.success || false,
        message: resp.data?.message || JSON.stringify(resp.data),
      })
      if (resp.data?.success) {
        message.success(t('settings.connectionOK'))
      } else {
        message.warning(t('settings.connectionFailed') + ': ' + resp.data?.message)
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || t('settings.connectionTestFailed'),
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSwitchProvider = async (providerType: string) => {
    try {
      await modelApi.switchProvider(providerType)
      message.success(t('settings.switched').replace('{provider}', providerType))
      loadConfig()
    } catch (err: any) {
      message.error(t('settings.switchFailed'))
    }
  }

  // 打开系统原生文件夹选择对话框 / Open native folder picker dialog
  const handleBrowseFolder = async () => {
    setBrowsingFolder(true)
    try {
      const resp = await systemApi.selectFolder()
      if (resp.data?.success && resp.data.path) {
        form.setFieldsValue({ workspace_path: resp.data.path })
        message.success(`${t('settings.folderSelected')}: ${resp.data.path}`)
      } else {
        message.info(resp.data?.message || t('settings.noFolderSelected'))
      }
    } catch (err: any) {
      message.error(t('settings.cannotOpenFolder') + ': ' + (err.message || ''))
    } finally {
      setBrowsingFolder(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip={t('settings.loadingConfig')} />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>
        <SettingOutlined /> {t('settings.title')}
      </Title>
      <Text type="secondary">
        {t('settings.description')}
      </Text>

      {/* Active Provider Status / 活跃后端状态 */}
      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text strong>{t('settings.activeProvider')}:</Text>
          <Tag color={activeTab === 'local' ? 'green' : activeTab === 'ollama' ? 'orange' : 'blue'}>
            {activeTab === 'local' ? `💻 ${t('settings.local')}`
              : activeTab === 'ollama' ? '🦙 Ollama'
              : `☁️ ${t('settings.online')}`}
          </Tag>
          <Divider type="vertical" />
          <Text type="secondary">{t('settings.quickSwitch')}:</Text>
          <Button
            size="small"
            type={activeTab === 'local' ? 'primary' : 'default'}
            icon={<LaptopOutlined />}
            onClick={() => handleSwitchProvider('local')}
          >
            {t('settings.localShort')}
          </Button>
          <Button
            size="small"
            type={activeTab === 'ollama' ? 'primary' : 'default'}
            icon={<CloudServerOutlined />}
            onClick={() => handleSwitchProvider('ollama')}
          >
            Ollama
          </Button>
          <Button
            size="small"
            type={activeTab === 'online' ? 'primary' : 'default'}
            icon={<ApiOutlined />}
            onClick={() => handleSwitchProvider('online')}
          >
            {t('settings.onlineShort')}
          </Button>
        </Space>
      </Card>

      {/* Provider Config Tabs / 后端配置标签页 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          tabBarExtraContent={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleTestConnection}
                loading={testing}
              >
                {t('settings.testConnection')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                {t('settings.saveConfig')}
              </Button>
            </Space>
          }
          items={[
            // ─── Tab: Local / 本地模型 ───
            {
              key: 'local',
              label: <span><LaptopOutlined /> {t('settings.local')}</span>,
              children: (
                <div>
                  <Alert
                    type="info"
                    message={
                      <span>
                        {t('settings.scanDir')}: <Text code>{scanned?.models_dir || 'models/'}</Text>
                        <Button size="small" type="link" icon={<ReloadOutlined />}
                          loading={scanning} onClick={scanModels}
                          style={{ marginLeft: 8 }}>
                          {t('settings.rescan')}
                        </Button>
                      </span>
                    }
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="model_path"
                      label={t('settings.modelFile')}
                      tooltip={t('settings.modelFileTooltip')}
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder={t('settings.selectModel')}
                        optionFilterProp="label"
                        notFoundContent={
                          scanned ? (
                            <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                              {t('settings.noGguf')}<br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {t('settings.putGguf')}: <Text code>{scanned.models_dir}</Text>
                              </Text>
                            </div>
                          ) : (
                            <div style={{ padding: 8 }}>{t('settings.scanning')}</div>
                          )
                        }
                        options={(scanned?.models || []).map((m) => ({
                          value: m.relative_path,
                          label: `${m.name} (${m.size_mb}MB) ${m.parent_dir ? '— ' + m.parent_dir : ''}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name="mmproj_path"
                      label={t('settings.mmproj')}
                      tooltip={t('settings.mmprojTooltip')}
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder={t('settings.selectMmproj')}
                        optionFilterProp="label"
                        notFoundContent={
                          <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                            {t('settings.noMmproj')}
                          </div>
                        }
                        options={(scanned?.mmproj || []).map((m) => ({
                          value: m.relative_path,
                          label: `${m.name} (${m.size_mb}MB)`,
                        }))}
                      />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }} size="large">
                      <Form.Item name="n_ctx" label={t('settings.contextLength')}>
                        <InputNumber min={512} max={32768} step={512} />
                      </Form.Item>
                      <Form.Item name="n_threads" label={t('settings.threads')}>
                        <InputNumber min={1} max={64} />
                      </Form.Item>
                      <Form.Item
                        name="gpu_layers"
                        label={t('settings.gpuLayers')}
                        tooltip={t('settings.gpuLayersTooltip')}
                      >
                        <InputNumber min={-1} max={999} />
                      </Form.Item>
                    </Space>
                    <Space wrap style={{ width: '100%' }} size="large">
                      <Form.Item name="temperature" label="Temperature">
                        <InputNumber min={0} max={2} step={0.1} />
                      </Form.Item>
                      <Form.Item name="top_p" label="Top P">
                        <InputNumber min={0} max={1} step={0.05} />
                      </Form.Item>
                    </Space>
                  </Form>
                </div>
              ),
            },
            // ─── Tab: Online / 在线API ───
            {
              key: 'online',
              label: <span><ApiOutlined /> {t('settings.online')}</span>,
              children: (
                <div>
                  <Alert
                    type="info"
                    message={t('settings.onlineAlert')}
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item name="provider" label={t('settings.provider')}>
                      <Select
                        options={[
                          { value: 'deepseek', label: 'DeepSeek' },
                          { value: 'kimi', label: 'Kimi / Moonshot' },
                          { value: 'glm', label: 'GLM' },
                          { value: 'gpt', label: 'OpenAI / GPT' },
                          { value: 'custom', label: t('settings.customProvider') },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name="api_base"
                      label={t('settings.apiBase')}
                      tooltip={t('settings.apiBaseTooltip')}
                    >
                      <Input placeholder="https://api.deepseek.com/v1" />
                    </Form.Item>
                    <Form.Item
                      name="api_key"
                      label={t('settings.apiKey')}
                      tooltip={t('settings.apiKeyTooltip')}
                    >
                      <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Form.Item name="model_name" label={t('settings.modelName')}>
                      <Input placeholder="deepseek-chat" />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }} size="large">
                      <Form.Item name="temperature" label="Temperature">
                        <InputNumber min={0} max={2} step={0.1} />
                      </Form.Item>
                      <Form.Item name="max_tokens" label={t('settings.maxTokens')}>
                        <InputNumber min={256} max={128000} step={256} />
                      </Form.Item>
                    </Space>
                  </Form>
                </div>
              ),
            },
            // ─── Tab: Ollama ───
            {
              key: 'ollama',
              label: <span><CloudServerOutlined /> Ollama</span>,
              children: (
                <div>
                  <Alert
                    type="info"
                    message={t('settings.ollamaAlert')}
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="host"
                      label={t('settings.ollamaHost')}
                      tooltip={t('settings.ollamaHostTooltip')}
                    >
                      <Input placeholder="http://localhost:11434" />
                    </Form.Item>
                    <Form.Item
                      name="model_name"
                      label={t('settings.modelName')}
                      tooltip={t('settings.ollamaModelTooltip')}
                    >
                      <Input placeholder="qwen3:latest" />
                    </Form.Item>
                    <Form.Item name="temperature" label="Temperature">
                      <InputNumber min={0} max={2} step={0.1} />
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
            // ─── Tab: Workspace / 工作空间 ───
            {
              key: 'workspace',
              label: <span><FolderOutlined /> {t('settings.workspace')}</span>,
              children: (
                <div>
                  <Alert
                    type="warning"
                    message={t('settings.workspaceAlert')}
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="workspace_enabled"
                      label={t('settings.enableWorkspace')}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="workspace_path"
                      label={t('settings.workspacePath')}
                      tooltip={t('settings.workspacePathTooltip')}
                      extra={
                        appHome && !form.getFieldValue('workspace_path')
                          ? `${t('settings.defaultPath')}: ${appHome} (${t('settings.appHomeDir')})`
                          : undefined
                      }
                    >
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder={appHome || 'D:\\MyWorkspace 或 /Users/name/Workspace'}
                          style={{ flex: 1 }}
                        />
                        <Button
                          icon={<FolderOutlined />}
                          onClick={handleBrowseFolder}
                          loading={browsingFolder}
                        >
                          {t('common.browse')}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                    <Paragraph type="secondary">
                      {t('settings.workspaceNote')}
                    </Paragraph>
                  </Form>
                </div>
              ),
            },
          ]}
        />

        {/* Connection Test Result / 连接测试结果 */}
        {testResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.success ? t('settings.connected') : t('settings.connectionFailed')}
              description={testResult.message}
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              showIcon
              closable
              onClose={() => setTestResult(null)}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default SettingsPage
