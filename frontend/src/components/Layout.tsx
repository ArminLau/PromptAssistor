/**
 * Main application layout with sidebar navigation and debug console.
 * / 主布局组件 — 侧边栏导航 + 调试控制台。
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Space, Button, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  ScanOutlined,
  ExpandOutlined,
  AppstoreOutlined,
  BookOutlined,
  ToolOutlined,
  SettingOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import DebugConsole from './DebugConsole'
import { useI18n } from '../i18n'
import { useAppStore } from '../stores/appStore'

const { Sider, Content, Footer, Header } = AntLayout

// 路由键列表（用于菜单高亮，不含翻译文本）
// / Route keys used for menu highlight (not translated).
const ROUTE_KEYS = ['/reverse', '/expand', '/batch', '/library', '/skills', '/settings']

// 根据当前路径计算高亮菜单键（支持 /batch/:datasetName 等子路由）
// / Compute the highlighted menu key from the current path (supports sub-routes like /batch/:datasetName)
function getSelectedKey(pathname: string): string {
  return ROUTE_KEYS.find((k) => pathname === k || pathname.startsWith(k + '/')) ?? '/reverse'
}

interface LayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)

  const menuItems: MenuProps['items'] = [
    { key: '/reverse', icon: <ScanOutlined />, label: t('nav.reverse') },
    { key: '/expand', icon: <ExpandOutlined />, label: t('nav.expand') },
    { key: '/batch', icon: <AppstoreOutlined />, label: t('nav.batch') },
    { key: '/library', icon: <BookOutlined />, label: t('nav.library') },
    { key: '/skills', icon: <ToolOutlined />, label: t('nav.skills') },
    { type: 'divider' },
    { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') },
  ]

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
          selectedKeys={[getSelectedKey(location.pathname)]}
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
        {/* 顶部栏：右上角语言切换 / Top bar: language toggle in top-right */}
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
            height: 48,
            lineHeight: 'normal',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space>
            <Tooltip title={t('lang.switchTo')}>
              <Button
                size="small"
                icon={<GlobalOutlined />}
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              >
                {language === 'zh' ? 'English' : '中文'}
              </Button>
            </Tooltip>
          </Space>
        </Header>
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
          {t('footer.backend')}: <code>http://127.0.0.1:18720</code> &nbsp;|&nbsp;
          {t('footer.docs')}: <code>http://127.0.0.1:18720/docs</code>
        </Footer>
      </AntLayout>
    </AntLayout>
  )
}

export default AppLayout
