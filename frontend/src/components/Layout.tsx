/**
 * Main application layout with sidebar navigation and debug console.
 * / 主布局组件 — 侧边栏导航 + 调试控制台。
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Space } from 'antd'
import type { MenuProps } from 'antd'
import {
  ScanOutlined,
  ExpandOutlined,
  AppstoreOutlined,
  BookOutlined,
  ToolOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import DebugConsole from './DebugConsole'

const { Sider, Content, Footer } = AntLayout

const menuItems: MenuProps['items'] = [
  { key: '/reverse', icon: <ScanOutlined />, label: '提示词反推' },
  { key: '/expand', icon: <ExpandOutlined />, label: '提示词扩写' },
  { key: '/batch', icon: <AppstoreOutlined />, label: '批量打标' },
  { key: '/library', icon: <BookOutlined />, label: '提示词库' },
  { key: '/skills', icon: <ToolOutlined />, label: 'Skill维护' },
  { type: 'divider' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
]

interface LayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  return (
    <AntLayout style={{ height: '100vh' }}>
      <Sider
        width={220}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
            borderBottom: '1px solid #f0f0f0',
            color: '#1677ff',
            flexShrink: 0,
          }}
        >
          PromptAssistor
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 8, flex: 1 }}
        />
        {/* Debug toggle at bottom of sidebar / 调试按钮在侧边栏底部 */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0' }}>
          <DebugConsole />
        </div>
      </Sider>
      <AntLayout>
        <Content
          style={{
            padding: 24,
            overflow: 'auto',
            background: '#f5f5f5',
          }}
        >
          {children}
        </Content>
        <Footer style={{
          textAlign: 'center',
          padding: '4px 16px',
          fontSize: 12,
          color: '#999',
          background: '#f5f5f5',
        }}>
          PromptAssistor v0.1.0 &nbsp;|&nbsp;
          后端地址 / Backend: <code>http://127.0.0.1:18720</code> &nbsp;|&nbsp;
          API文档 / Docs: <code>http://127.0.0.1:18720/docs</code>
        </Footer>
      </AntLayout>
    </AntLayout>
  )
}

export default AppLayout
