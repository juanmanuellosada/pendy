import { create } from 'zustand'

const DETAIL_WIDTH_KEY = 'pendy-detail-width'
const DEFAULT_DETAIL_WIDTH = 384 // w-96
const MIN_DETAIL_WIDTH = 320
const MAX_DETAIL_WIDTH = 700

function loadDetailWidth(): number {
  try {
    const v = localStorage.getItem(DETAIL_WIDTH_KEY)
    if (v) {
      const n = parseInt(v, 10)
      if (n >= MIN_DETAIL_WIDTH && n <= MAX_DETAIL_WIDTH) return n
    }
  } catch { /* ignore */ }
  return DEFAULT_DETAIL_WIDTH
}

interface AppState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  selectedTaskId: string | null
  taskDetailOpen: boolean
  quickAddOpen: boolean
  searchOpen: boolean
  detailPanelWidth: number

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSelectedTaskId: (id: string | null) => void
  setTaskDetailOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setDetailPanelWidth: (width: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  selectedTaskId: null,
  taskDetailOpen: false,
  quickAddOpen: false,
  searchOpen: false,
  detailPanelWidth: loadDetailWidth(),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, taskDetailOpen: id !== null }),
  setTaskDetailOpen: (open) => set({ taskDetailOpen: open, selectedTaskId: open ? undefined : null }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setDetailPanelWidth: (width) => {
    const clamped = Math.max(MIN_DETAIL_WIDTH, Math.min(MAX_DETAIL_WIDTH, width))
    localStorage.setItem(DETAIL_WIDTH_KEY, String(clamped))
    set({ detailPanelWidth: clamped })
  },
}))
