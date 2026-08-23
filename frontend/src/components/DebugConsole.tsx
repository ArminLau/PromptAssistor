/**
 * Debug console component — shows system status and recent logs.
 * / 调试控制台组件 — 显示系统状态和最近日志。
 */

import React, { useEffect, useState, useRef } from 'react'
import { Drawer, Button, Badge, Tag, Space, Typography, List, Tooltip } from 'antd'
import {
  BugOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { useI18n } from '../i18n'

const { Text, Paragraph } = Typography

interface CheckItem {
  name: string
  status: 'ok' | 'warning' | 'error'
  message: string
  detail: string
  fix: string
}

interface SystemCheckResult {
  overall_status: 'ok' | 'warning' | 'error'
  ok_count: number
  warning_count: number
  error_count: number
  all_ok: boolean
  results: CheckItem[]
}

const API_BASE = 'http://127.0.0.1:18720'

const DebugConsole: React.FC = () => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState<SystemCheckResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Check backend health on mount / 挂载时检查后端状态
  useEffect(() => {
    checkBackend()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkBackend = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/health`, { timeout: 3000 })
      setBackendReachable(resp.data?.status === 'ok')
    } catch {
      setBackendReachable(false)
    }
  }

  const runSystemCheck = async () => {
    setLoading(true)
    try {
      const resp = await axios.get(`${API_BASE}/system-check`, { timeout: 10000 })
      setChecks(resp.data)
    } catch (err: any) {
      setChecks({
        overall_status: 'error',
        ok_count: 0,
        warning_count: 0,
        error_count: 1,
        all_ok: false,
        results: [{
          name: t('debug.backendConnection'),
          status: 'error',
          message: t('debug.cannotReach'),
          detail: err.message || t('common.unknownError'),
          fix: t('debug.ensureBackend') + ': scripts\\dev_backend.bat',
        }],
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/api/v1/system/logs`, { params: { lines: 50 } })
      setLogs(resp.data?.logs || [])
    } catch {
      setLogs([t('debug.cannotFetchLogs')])
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'warning': return <WarningOutlined style={{ color: '#faad14' }} />
      case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default: return null
    }
  }

  const getBadgeStatus = (): "success" | "processing" | "error" | "warning" | "default" => {
    if (backendReachable === null) return 'processing'
    if (!checks) return backendReachable ? 'success' : 'error'
    if (checks.all_ok) return 'success'
    if (checks.error_count > 0) return 'error'
    return 'warning'
  }

  const getBadgeText = () => {
    if (backendReachable === null) return t('debug.checking')
    if (backendReachable === false) return t('debug.offline')
    if (!checks) return t('debug.online')
    if (checks.all_ok) return t('debug.allOK')
    return `${checks.error_count}E ${checks.warning_count}W`
  }

  return (
    <>
      {/* Trigger button / 触发按钮 */}
      <Tooltip title={t('debug.title')}>
        <Button
          type="text"
          icon={
            <Badge status={getBadgeStatus()} offset={[-3, 3]}>
              <BugOutlined style={{ fontSize: 16 }} />
            </Badge>
          }
          onClick={() => {
            setOpen(true)
            runSystemCheck()
            fetchLogs()
          }}
          style={{ color: 'inherit' }}
        >
          {getBadgeText()}
        </Button>
      </Tooltip>

      {/* Debug Drawer / 调试面板 */}
      <Drawer
        title={
          <Space>
            <BugOutlined />
            {t('debug.title')}
          </Space>
        }
        placement="bottom"
        height="50vh"
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={checkBackend}>
              {t('debug.checkBackend')}
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={runSystemCheck} loading={loading}>
              {t('debug.runChecks')}
            </Button>
          </Space>
        }
      >
        {/* Backend Status Banner / 后端状态横幅 */}
        {backendReachable === false && (
          <div style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}>
            <Text strong style={{ color: '#ff4d4f' }}>
              ⚠ {t('debug.backendNotRunning')}
            </Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {t('debug.startBackend')}:<br/>
              <Text code>scripts\dev_backend.bat</Text> (Windows) 或 <Text code>bash scripts/dev_backend.sh</Text> (macOS)<br/>
              {t('debug.backendUrl')}: <Text code>http://127.0.0.1:18720</Text><br/>
              {t('debug.verify')}: <Text code>http://127.0.0.1:18720/health</Text>
            </Paragraph>
          </div>
        )}

        {/* System Check Results / 系统检查结果 */}
        {checks && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>
              {t('debug.systemChecks')}:
              <Tag color={getBadgeStatus()} style={{ marginLeft: 8 }}>
                {checks.ok_count} OK / {checks.warning_count} WARN / {checks.error_count} ERR
              </Tag>
            </Text>
            <List
              size="small"
              dataSource={checks.results}
              renderItem={(item: CheckItem) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={getStatusIcon(item.status)}
                    title={item.name}
                    description={
                      <>
                        <div>{item.message}</div>
                        {item.fix && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">🔧 {item.fix}</Text>
                          </div>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}

        {/* Recent Logs / 最近日志 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>{t('debug.recentLogs')}</Text>
            <Button size="small" onClick={fetchLogs}>{t('debug.refresh')}</Button>
          </div>
          <div
            ref={logEndRef}
            style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: 12,
              borderRadius: 8,
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {logs.length === 0 ? (
              <Text style={{ color: '#888' }}>{t('debug.noLogs')}</Text>
            ) : (
              logs.map((line, i) => (
                <div key={i} style={{
                  color: line.includes('[WARNING]') ? '#faad14'
                       : line.includes('[ERROR]') ? '#ff4d4f'
                       : '#d4d4d4'
                }}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>
    </>
  )
}

export default DebugConsole
