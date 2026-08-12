/**
 * Root application component for PromptAssistor.
 *
 * Provides the main layout with sidebar navigation and page routing.
 */

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/Layout'

// Lazy load feature pages / 懒加载功能页面
const ReversePage = React.lazy(() => import('./pages/ReversePage'))
const ExpandPage = React.lazy(() => import('./pages/ExpandPage'))
const BatchPage = React.lazy(() => import('./pages/BatchPage'))
const LibraryPage = React.lazy(() => import('./pages/LibraryPage'))
const SkillEditorPage = React.lazy(() => import('./pages/SkillEditorPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <Layout>
        <React.Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/reverse" replace />} />
            <Route path="/reverse" element={<ReversePage />} />
            <Route path="/expand" element={<ExpandPage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/skills" element={<SkillEditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </React.Suspense>
      </Layout>
    </ConfigProvider>
  )
}

export default App
