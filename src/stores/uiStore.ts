import { create } from 'zustand'

interface UIState {
  currentView: string
  editingProjectId: string | null
  projectEditorOpen: boolean
  confirmDialogOpen: boolean
  confirmDialogConfig: {
    title: string
    message: string
    onConfirm: () => void
  } | null

  setCurrentView: (view: string) => void
  setEditingProjectId: (id: string | null) => void
  setProjectEditorOpen: (open: boolean) => void
  showConfirmDialog: (config: { title: string; message: string; onConfirm: () => void }) => void
  hideConfirmDialog: () => void
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'today',
  editingProjectId: null,
  projectEditorOpen: false,
  confirmDialogOpen: false,
  confirmDialogConfig: null,

  setCurrentView: (view) => set({ currentView: view }),
  setEditingProjectId: (id) => set({ editingProjectId: id }),
  setProjectEditorOpen: (open) => set({ projectEditorOpen: open }),
  showConfirmDialog: (config) => set({ confirmDialogOpen: true, confirmDialogConfig: config }),
  hideConfirmDialog: () => set({ confirmDialogOpen: false, confirmDialogConfig: null }),
}))
