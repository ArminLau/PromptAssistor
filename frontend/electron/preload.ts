/**
 * Preload script for PromptAssistor.
 *
 * Provides a secure bridge between the Electron main process
 * and the React renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // Backend status
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  onBackendReady: (callback: () => void) => {
    ipcRenderer.on('backend-ready', callback)
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
})
