import { useParams, Navigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { ProjectView } from '@/components/projects/ProjectView'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: projects, isPending } = useProjects()

  if (isPending || !projects) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    )
  }

  const project = projects.find((p) => p.id === projectId)

  if (!project) {
    return <Navigate to="/app/today" replace />
  }

  return <ProjectView project={project} />
}
