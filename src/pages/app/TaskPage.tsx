import { useParams, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { TaskDetail } from '@/components/tasks/TaskDetail'

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)

  // Clear the panel selection so the sidebar panel doesn't also render
  useEffect(() => {
    setSelectedTaskId(null)
  }, [setSelectedTaskId])

  if (!taskId) return <Navigate to="/app/today" replace />

  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-3.5rem)]">
      <TaskDetail fullScreen taskId={taskId} />
    </div>
  )
}
