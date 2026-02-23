import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewStyle = 'list' | 'panel' | 'calendar'
export type GroupBy = 'none' | 'priority' | 'label' | 'project'
export type SortBy = 'manual' | 'due_date' | 'priority' | 'name'
export type FilterDueDate = 'all' | 'today' | 'week' | 'overdue' | 'nodate'
export type CalendarMode = 'month' | 'week' | '4days' | 'day'

export interface ViewOptions {
  viewStyle: ViewStyle
  showCompleted: boolean
  groupBy: GroupBy
  sortBy: SortBy
  filterPriority: number | null
  filterLabelId: string | null
  filterDueDate: FilterDueDate
  calendarMode: CalendarMode
}

export const defaultViewOptions: ViewOptions = {
  viewStyle: 'list',
  showCompleted: false,
  groupBy: 'none',
  sortBy: 'manual',
  filterPriority: null,
  filterLabelId: null,
  filterDueDate: 'all',
  calendarMode: 'month',
}

interface UIState {
  currentView: string
  editingProjectId: string | null
  projectEditorOpen: boolean
  confirmDialogOpen: boolean
  confirmDialogConfig: {
    title: string
    message: string
    confirmLabel?: string
    onConfirm: () => void
  } | null
  viewOptions: Record<string, ViewOptions>

  setCurrentView: (view: string) => void
  setEditingProjectId: (id: string | null) => void
  setProjectEditorOpen: (open: boolean) => void
  showConfirmDialog: (config: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) => void
  hideConfirmDialog: () => void
  getViewOptions: (viewId: string) => ViewOptions
  setViewOption: <K extends keyof ViewOptions>(viewId: string, key: K, value: ViewOptions[K]) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentView: 'today',
      editingProjectId: null,
      projectEditorOpen: false,
      confirmDialogOpen: false,
      confirmDialogConfig: null,
      viewOptions: {},

      setCurrentView: (view) => set({ currentView: view }),
      setEditingProjectId: (id) => set({ editingProjectId: id }),
      setProjectEditorOpen: (open) => set({ projectEditorOpen: open }),
      showConfirmDialog: (config) =>
        set({ confirmDialogOpen: true, confirmDialogConfig: config }),
      hideConfirmDialog: () =>
        set({ confirmDialogOpen: false, confirmDialogConfig: null }),

      getViewOptions: (viewId) => get().viewOptions[viewId] ?? defaultViewOptions,

      setViewOption: (viewId, key, value) =>
        set((state) => ({
          viewOptions: {
            ...state.viewOptions,
            [viewId]: {
              ...(state.viewOptions[viewId] ?? defaultViewOptions),
              [key]: value,
            },
          },
        })),
    }),
    {
      name: 'pendy-ui',
      partialize: (state) => ({ viewOptions: state.viewOptions }),
    },
  ),
)
