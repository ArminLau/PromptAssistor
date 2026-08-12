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
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState<SystemCheckResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Check backend health on mount / 挂载时检查后端状态
  useEffect(() => {
    checkBackend()
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
          name: 'Backend Connection / 后端连接',
          status: 'error',
          message: 'Cannot reach backend / 无法连接后端',
          detail: err.message || 'Unknown error',
          fix: '请确认后端已启动 / Ensure backend is running: scripts\\dev_backend.bat',
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
      setLogs(['Cannot fetch logs / 无法获取日志'])
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
    if (backendReachable === null) return '检查中...'
    if (backendReachable === false) return '离线'
    if (!checks) return '在线'
    if (checks.all_ok) return '全部正常'
    return `${checks.error_count}E ${checks.warning_count}W`
  }

  return (
    <>
      {/* Trigger button / 触发按钮 */}
      <Tooltip title="系统诊断 / System Diagnostics">
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
            系统诊断 / System Diagnostics
          </Space>
        }
        placement="bottom"
        height="50vh"
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={checkBackend}>
              检查后端 / Check Backend
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={runSystemCheck} loading={loading}>
              运行检测 / Run Checks
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
              ⚠ 后端服务未启动 / Backend Not Running
            </Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              请先启动Python后端服务 / Please start the Python backend first:<br/>
              <Text code>scripts\dev_backend.bat</Text> (Windows) 或 <Text code>bash scripts/dev_backend.sh</Text> (macOS)<br/>
              后端地址 / Backend URL: <Text code>http://127.0.0.1:18720</Text><br/>
              启动后请确认可访问 / Verify: <Text code>http://127.0.0.1:18720/health</Text>
            </Paragraph>
          </div>
        )}

        {/* System Check Results / 系统检查结果 */}
        {checks && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>
              系统检查 / System Checks:
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
            <Text strong>最近日志 / Recent Logs</Text>
            <Button size="small" onClick={fetchLogs}>刷新 / Refresh</Button>
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
              <Text style={{ color: '#888' }}>暂无日志 / No logs yet — 启动后端后可见 / visible after backend starts</Text>
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
