/**
 * Backend process manager for PromptAssistor.
 *
 * Manages the lifecycle of the Python FastAPI backend process:
 * - Spawns the backend on app start
 * - Monitors health check
 * - Kills the backend on app quit
 *
 * During development, the backend is started separately
 * (via scripts/dev_backend.bat or scripts/dev_backend.sh).
 */

import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'

let backendProcess: ChildProcess | null = null

const BACKEND_PORT = 18720
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`

/**
 * Start the Python backend if running in production mode.
 * In development, the backend is started manually.
 */
export async function startBackend(): Promise<string> {
  // In development, backend is started separately
  if (!app.isPackaged) {
    console.log('[Dev] Backend should be started separately on port', BACKEND_PORT)
    return BACKEND_URL
  }

  // In production, spawn the Python backend
  const backendDir = path.join(process.resourcesPath, 'backend')

  // Determine Python executable path
  const isWindows = process.platform === 'win32'
  const pythonExe = isWindows
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python')

  console.log('[Backend] Starting Python backend...')

  backendProcess = spawn(pythonExe, [
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1',
    '--port', String(BACKEND_PORT),
  ], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend] ${data}`)
  })

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Backend Error] ${data}`)
  })

  backendProcess.on('exit', (code) => {
    console.log(`[Backend] Process exited with code ${code}`)
  })

  // Wait for backend to be ready
  await waitForBackend()
  console.log('[Backend] Ready!')
  return BACKEND_URL
}

/**
 * Stop the backend process.
 */
export function stopBackend(): void {
  if (backendProcess) {
    console.log('[Backend] Stopping...')
    backendProcess.kill()
    backendProcess = null
  }
}

/**
 * Poll the backend health endpoint until it responds.
 */
async function waitForBackend(maxRetries = 30, interval = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await healthCheck()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }
  throw new Error('Backend failed to start within timeout')
}

/**
 * Check if the backend is healthy.
 */
function healthCheck(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BACKEND_URL}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve()
      } else {
        reject(new Error(`Health check returned ${res.statusCode}`))
      }
    })
    req.on('error', reject)
    req.setTimeout(2000, () => {
      req.destroy()
      reject(new Error('Health check timeout'))
    })
  })
}
