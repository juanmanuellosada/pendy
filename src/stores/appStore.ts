import { create } from 'zustand'

interface AppState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  selectedTaskId: string | null
  taskDetailOpen: boolean
  quickAddOpen: boolean
  searchOpen: boolean

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSelectedTaskId: (id: string | null) => void
  setTaskDetailOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  selectedTaskId: null,
  taskDetailOpen: false,
  quickAddOpen: false,
  searchOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, taskDetailOpen: id !== null }),
  setTaskDetailOpen: (open) => set({ taskDetailOpen: open, selectedTaskId: open ? undefined : null }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}))
