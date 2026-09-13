/**
 * Root application component for PromptAssistor.
 *
 * Provides the main layout with sidebar navigation and page routing.
 */

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import Layout from './components/Layout'
import { useAppStore } from './stores/appStore'
import { useI18n } from './i18n'

// Lazy load feature pages / 懒加载功能页面
const GeneratePage = React.lazy(() => import('./pages/GeneratePage'))
const ReversePage = React.lazy(() => import('./pages/ReversePage'))
const ExpandPage = React.lazy(() => import('./pages/ExpandPage'))
const BatchPage = React.lazy(() => import('./pages/BatchPage'))
const LibraryPage = React.lazy(() => import('./pages/LibraryPage'))
const SkillEditorPage = React.lazy(() => import('./pages/SkillEditorPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))

const App: React.FC = () => {
  const language = useAppStore((s) => s.language)
  const { t } = useI18n()

  return (
    <ConfigProvider
      locale={language === 'zh' ? zhCN : enUS}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <Layout>
        <React.Suspense fallback={<div style={{ padding: 24 }}>{t('common.loading')}</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/reverse" replace />} />
            <Route path="/generate" element={<GeneratePage />} />
            <Route path="/reverse" element={<ReversePage />} />
            <Route path="/expand" element={<ExpandPage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/batch/:datasetName" element={<BatchPage />} />
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
