import { useState, useCallback } from 'react'

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const enter = useCallback(() => setIsSelectMode(true), [])

  const exit = useCallback(() => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)))
  }, [items])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    isSelectMode,
    selectedIds,
    enter,
    exit,
    toggle,
    selectAll,
    clearAll,
    allSelected: items.length > 0 && selectedIds.size === items.length,
  }
}
