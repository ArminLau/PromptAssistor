/**
 * Global application state store using Zustand.
 */

import { create } from 'zustand'

interface AppState {
  // Backend connection
  backendReady: boolean
  setBackendReady: (ready: boolean) => void

  // Active model/skill per feature
  activeModels: Record<string, string>
  setActiveModel: (featureId: string, skillName: string) => void

  // UI state
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  backendReady: false,
  setBackendReady: (ready) => set({ backendReady: ready }),

  activeModels: {},
  setActiveModel: (featureId, skillName) =>
    set((state) => ({
      activeModels: { ...state.activeModels, [featureId]: skillName },
    })),

  loading: false,
  setLoading: (loading) => set({ loading }),
}))
