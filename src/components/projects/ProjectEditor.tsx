import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { ColorPicker } from '@/components/common/ColorPicker'
import { PROJECT_COLORS } from '@/lib/constants'
import type { Project } from '@/lib/types'

interface ProjectEditorProps {
  open: boolean
  onClose: () => void
  project?: Project | null
  parentId?: string | null
}

export function ProjectEditor({ open, onClose, project, parentId }: ProjectEditorProps) {
  const { user } = useAuth()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setIcon(project.icon ?? '')
    } else {
      setName('')
      setColor(PROJECT_COLORS[0])
      setIcon('')
    }
  }, [project, open])

  const handleSubmit = async () => {
    if (!name.trim() || !user) return

    if (project) {
      await updateProject.mutateAsync({
        id: project.id,
        updates: { name: name.trim(), color, icon: icon || null },
      })
    } else {
      await createProject.mutateAsync({
        user_id: user.id,
        name: name.trim(),
        color,
        icon: icon || null,
        parent_id: parentId ?? null,
      })
    }

    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {project ? 'Editar proyecto' : parentId ? 'Nuevo subproyecto' : 'Nuevo proyecto'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Nombre
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              placeholder="Nombre del proyecto"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Color
            </label>
            <div className="flex items-center gap-3">
              <ColorPicker value={color} onChange={setColor} />
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? 'var(--text-primary)' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || createProject.isPending || updateProject.isPending}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#283B56' }}
          >
            {project ? 'Guardar' : parentId ? 'Crear subproyecto' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}
