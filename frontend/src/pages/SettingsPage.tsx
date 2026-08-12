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
      message.error('加载配置失败 / Failed to load config: ' + (err.message || '未知错误'))
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
      message.error('扫描模型目录失败 / Scan failed: ' + (err.message || '未知错误'))
    } finally {
      setScanning(false)
    }
  }

  // 切换到本地模型tab时重新扫描 / Rescan when switching to local tab
  useEffect(() => {
    if (activeTab === 'local') {
      scanModels()
    }
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
          n_ctx: values.n_ctx || 4096,
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
      message.success('配置已保存 / Configuration saved')
    } catch (err: any) {
      message.error('保存失败 / Save failed: ' + (err.message || '未知错误'))
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
        message.success('连接成功 / Connection OK')
      } else {
        message.warning('连接失败 / Connection failed: ' + resp.data?.message)
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || '连接测试失败',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSwitchProvider = async (providerType: string) => {
    try {
      await modelApi.switchProvider(providerType)
      message.success(`已切换到 ${providerType} / Switched to ${providerType}`)
      loadConfig()
    } catch (err: any) {
      message.error('切换失败 / Switch failed')
    }
  }

  // 打开系统原生文件夹选择对话框 / Open native folder picker dialog
  const handleBrowseFolder = async () => {
    setBrowsingFolder(true)
    try {
      const resp = await systemApi.selectFolder()
      if (resp.data?.success && resp.data.path) {
        form.setFieldsValue({ workspace_path: resp.data.path })
        message.success(`已选择: ${resp.data.path}`)
      } else {
        message.info(resp.data?.message || '未选择文件夹 / No folder selected')
      }
    } catch (err: any) {
      message.error('无法打开文件夹选择器 / Cannot open folder picker: ' + (err.message || ''))
    } finally {
      setBrowsingFolder(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip="加载配置中 / Loading config..." />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>
        <SettingOutlined /> 设置 / Settings
      </Title>
      <Text type="secondary">
        配置LLM后端提供者、模型参数和工作空间 / Configure LLM providers, model parameters, and workspace
      </Text>

      {/* Active Provider Status / 活跃后端状态 */}
      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text strong>当前后端 / Active Provider:</Text>
          <Tag color={activeTab === 'local' ? 'green' : activeTab === 'ollama' ? 'orange' : 'blue'}>
            {activeTab === 'local' ? '💻 本地模型 / Local'
              : activeTab === 'ollama' ? '🦙 Ollama'
              : '☁️ 在线API / Online'}
          </Tag>
          <Divider type="vertical" />
          <Text type="secondary">快速切换 / Quick Switch:</Text>
          <Button
            size="small"
            type={activeTab === 'local' ? 'primary' : 'default'}
            icon={<LaptopOutlined />}
            onClick={() => handleSwitchProvider('local')}
          >
            本地 / Local
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
            在线 / Online
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
                测试连接 / Test Connection
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                保存配置 / Save Config
              </Button>
            </Space>
          }
          items={[
            // ─── Tab: Local / 本地模型 ───
            {
              key: 'local',
              label: <span><LaptopOutlined /> 本地模型 / Local</span>,
              children: (
                <div>
                  <Alert
                    type="info"
                    message={
                      <span>
                        扫描目录 / Scan dir: <Text code>{scanned?.models_dir || 'models/'}</Text>
                        <Button size="small" type="link" icon={<ReloadOutlined />}
                          loading={scanning} onClick={scanModels}
                          style={{ marginLeft: 8 }}>
                          重新扫描 / Rescan
                        </Button>
                      </span>
                    }
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="model_path"
                      label="模型文件 / Model File"
                      tooltip="从 models/ 目录下扫描到的GGUF模型文件 / GGUF files scanned from models/ directory"
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder="选择模型文件 / Select a model file..."
                        optionFilterProp="label"
                        notFoundContent={
                          scanned ? (
                            <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                              未找到GGUF文件 / No GGUF files found<br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                请将 .gguf 文件放入 / Put .gguf files in: <Text code>{scanned.models_dir}</Text>
                              </Text>
                            </div>
                          ) : (
                            <div style={{ padding: 8 }}>扫描中... / Scanning...</div>
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
                      label="多模态投影器 / mmproj (可选/Optional)"
                      tooltip="视觉模型的多模态投影器文件 / Multimodal projector for vision models"
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder="选择投影器文件(可选) / Select mmproj file (optional)..."
                        optionFilterProp="label"
                        notFoundContent={
                          <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                            未找到mmproj文件 / No mmproj files found
                          </div>
                        }
                        options={(scanned?.mmproj || []).map((m) => ({
                          value: m.relative_path,
                          label: `${m.name} (${m.size_mb}MB)`,
                        }))}
                      />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }} size="large">
                      <Form.Item name="n_ctx" label="上下文长度 / Context Length">
                        <InputNumber min={512} max={32768} step={512} />
                      </Form.Item>
                      <Form.Item name="n_threads" label="CPU线程数 / Threads">
                        <InputNumber min={1} max={64} />
                      </Form.Item>
                      <Form.Item
                        name="gpu_layers"
                        label="GPU层数 / GPU Layers"
                        tooltip="-1 = 全部GPU / all GPU, 0 = 仅CPU / CPU only"
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
              label: <span><ApiOutlined /> 在线API / Online</span>,
              children: (
                <div>
                  <Alert
                    type="info"
                    message="支持所有OpenAI兼容的API服务 / Supports all OpenAI-compatible API services"
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item name="provider" label="API服务商 / Provider">
                      <Select
                        options={[
                          { value: 'deepseek', label: 'DeepSeek' },
                          { value: 'kimi', label: 'Kimi / Moonshot' },
                          { value: 'glm', label: 'GLM / 智谱AI' },
                          { value: 'gpt', label: 'OpenAI / GPT' },
                          { value: 'custom', label: '自定义 / Custom (OpenAI Compatible)' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name="api_base"
                      label="API地址 / API Base URL"
                      tooltip="OpenAI兼容的API端点 / OpenAI-compatible endpoint"
                    >
                      <Input placeholder="https://api.deepseek.com/v1" />
                    </Form.Item>
                    <Form.Item
                      name="api_key"
                      label="API密钥 / API Key"
                      tooltip="不会提交到Git仓库 / Will not be committed to Git"
                    >
                      <Input.Password placeholder="sk-..." />
                    </Form.Item>
                    <Form.Item name="model_name" label="模型名称 / Model Name">
                      <Input placeholder="deepseek-chat" />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }} size="large">
                      <Form.Item name="temperature" label="Temperature">
                        <InputNumber min={0} max={2} step={0.1} />
                      </Form.Item>
                      <Form.Item name="max_tokens" label="最大Token数 / Max Tokens">
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
                    message="需要先在本地安装并启动 Ollama / Requires Ollama installed and running locally"
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="host"
                      label="Ollama地址 / Ollama Host"
                      tooltip="Ollama服务的HTTP地址 / HTTP address of the Ollama service"
                    >
                      <Input placeholder="http://localhost:11434" />
                    </Form.Item>
                    <Form.Item
                      name="model_name"
                      label="模型名称 / Model Name"
                      tooltip="使用 ollama list 查看已安装的模型 / Use ollama list to see installed models"
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
              label: <span><FolderOutlined /> 工作空间 / Workspace</span>,
              children: (
                <div>
                  <Alert
                    type="warning"
                    message="工作空间可让skills/models/output文件存放到项目外，保护隐私 / Workspace keeps files outside the project for privacy"
                    style={{ marginBottom: 16 }}
                    showIcon
                  />
                  <Form form={form} layout="vertical">
                    <Form.Item
                      name="workspace_enabled"
                      label="启用工作空间 / Enable Workspace"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      name="workspace_path"
                      label="工作空间路径 / Workspace Path"
                      tooltip="手动输入路径或点击浏览按钮从系统中选择 / Type path or click Browse to select"
                      extra={
                        appHome && !form.getFieldValue('workspace_path')
                          ? `默认: ${appHome} (exe所在目录 / app home directory)`
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
                          浏览 / Browse
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                    <Paragraph type="secondary">
                      点击"浏览"按钮从系统中选择文件夹，或手动输入路径。
                      启用后立即生效。工作空间目录将自动创建 skills/、models/、output/ 子目录。
                      / Click "Browse" to select a folder, or type the path manually.
                      Takes effect immediately. Subdirectories will be auto-created.
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
              message={testResult.success ? '连接成功 / Connected' : '连接失败 / Connection Failed'}
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
