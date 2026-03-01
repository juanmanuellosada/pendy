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
  eventEditorOpen: boolean
  searchOpen: boolean
  detailPanelWidth: number
  // Habit detail panel
  selectedHabitId: string | null
  selectedHabitDate: string | null  // 'yyyy-MM-dd'
  habitDetailOpen: boolean

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSelectedTaskId: (id: string | null) => void
  setTaskDetailOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setEventEditorOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setDetailPanelWidth: (width: number) => void
  setSelectedHabit: (id: string | null, date?: string | null) => void
  setHabitDetailOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  selectedTaskId: null,
  taskDetailOpen: false,
  quickAddOpen: false,
  eventEditorOpen: false,
  searchOpen: false,
  detailPanelWidth: loadDetailWidth(),
  selectedHabitId: null,
  selectedHabitDate: null,
  habitDetailOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, taskDetailOpen: id !== null, habitDetailOpen: false }),
  setTaskDetailOpen: (open) => set({ taskDetailOpen: open, selectedTaskId: open ? undefined : null, habitDetailOpen: false }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
  setEventEditorOpen: (open) => set({ eventEditorOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setDetailPanelWidth: (width) => {
    const clamped = Math.max(MIN_DETAIL_WIDTH, Math.min(MAX_DETAIL_WIDTH, width))
    localStorage.setItem(DETAIL_WIDTH_KEY, String(clamped))
    set({ detailPanelWidth: clamped })
  },
  setSelectedHabit: (id, date) => set({
    selectedHabitId: id,
    selectedHabitDate: date ?? null,
    habitDetailOpen: id !== null,
    taskDetailOpen: false,
    selectedTaskId: null,
  }),
  setHabitDetailOpen: (open) => set({ habitDetailOpen: open, selectedHabitId: open ? undefined : null }),
}))
