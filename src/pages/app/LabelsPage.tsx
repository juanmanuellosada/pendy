import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, Star, ListChecks, ChevronRight } from 'lucide-react'
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, LABEL_COLORS } from '@/hooks/useLabels'
import { useUIStore } from '@/stores/uiStore'
import { ColorPicker } from '@/components/common/ColorPicker'
import { useAuth } from '@/hooks/useAuth'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { BulkActionBar } from '@/components/common/BulkActionBar'

export default function LabelsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: labels = [] } = useLabels()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const { showConfirmDialog } = useUIStore()

  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[3]!)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelName, setEditingLabelName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const { isSelectMode, selectedIds, enter, exit, toggle, selectAll, clearAll, allSelected } =
    useBulkSelection(labels)

  const handleCreate = async () => {
    const name = newLabelName.trim()
    if (!name) return
    await createLabel.mutateAsync({ name, color: newLabelColor })
    setNewLabelName('')
    setNewLabelColor(LABEL_COLORS[3]!)
  }

  const startEdit = (id: string, name: string) => {
    if (isSelectMode) return
    setEditingLabelId(id)
    setEditingLabelName(name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const saveEdit = (id: string, currentColor: string) => {
    const name = editingLabelName.trim()
    if (name) updateLabel.mutate({ id, updates: { name, color: currentColor } })
    setEditingLabelId(null)
  }

  const handleDelete = (id: string, name: string) => {
    showConfirmDialog({
      title: 'Eliminar etiqueta',
      message: `¿Eliminar la etiqueta «${name}»? Se quitará de todas las tareas que la usen.`,
      confirmLabel: 'Eliminar',
      onConfirm: () => deleteLabel.mutate(id),
    })
  }

  const handleBulkDelete = () => {
    showConfirmDialog({
      title: `¿Eliminar ${selectedIds.size} ${selectedIds.size === 1 ? 'etiqueta' : 'etiquetas'}?`,
      message: 'Se quitarán de todas las tareas que las usen. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await Promise.all(Array.from(selectedIds).map((id) => deleteLabel.mutateAsync(id)))
        exit()
      },
    })
  }

  const toggleFavorite = (id: string, current: boolean) => {
    updateLabel.mutate({ id, updates: { is_favorite: !current } })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Mis etiquetas
        </h1>
        {!isSelectMode && labels.length > 0 && (
          <button
            onClick={enter}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
          >
            <ListChecks size={14} />
            Seleccionar
          </button>
        )}
      </div>

      {/* Formulario de creación */}
      {!isSelectMode && (
        <div className="mb-6 flex items-center gap-2">
          <ColorPicker value={newLabelColor} onChange={setNewLabelColor} />
          <input
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Nombre de la etiqueta..."
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newLabelName.trim() || createLabel.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#283B56' }}
          >
            <Plus size={14} />
            Crear
          </button>
        </div>
      )}

      {/* Lista */}
      {labels.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay etiquetas creadas aún.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border" style={{ borderColor: 'var(--border-primary)' }}>
          {labels.map((label, i) => {
            const isEditing = editingLabelId === label.id
            const isLast = i === labels.length - 1
            const isSelected = selectedIds.has(label.id)
            return (
              <div
                key={label.id}
                className="group flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border-primary)',
                  backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                  cursor: isSelectMode || isEditing ? 'default' : 'pointer',
                }}
                onClick={
                  isSelectMode
                    ? () => toggle(label.id)
                    : isEditing
                    ? undefined
                    : () => navigate(`/app/label/${label.id}`)
                }
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? 'rgba(59,130,246,0.08)'
                    : 'transparent'
                }}
              >
                {/* Checkbox de selección */}
                {isSelectMode ? (
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: isSelected ? '#3B82F6' : 'var(--border-primary)',
                      backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ColorPicker
                      size="sm"
                      value={label.color}
                      onChange={(color) => updateLabel.mutate({ id: label.id, updates: { color } })}
                    />
                  </div>
                )}

                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editingLabelName}
                    onChange={(e) => setEditingLabelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(label.id, label.color)
                      if (e.key === 'Escape') setEditingLabelId(null)
                    }}
                    onBlur={() => saveEdit(label.id, label.color)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 rounded border px-2 py-0.5 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(label.id, label.name) }}
                  >
                    {label.name}
                  </span>
                )}

                {!isSelectMode && !isEditing && (
                  <ChevronRight
                    size={14}
                    className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
                    style={{ color: 'var(--text-muted)' }}
                  />
                )}

                {!isSelectMode && (
                  <>
                    {/* Favorito */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(label.id, label.is_favorite) }}
                      className="rounded p-1 transition-colors"
                      style={{ color: label.is_favorite ? '#F59E0B' : 'var(--text-muted)' }}
                      title={label.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    >
                      <Star
                        size={14}
                        fill={label.is_favorite ? '#F59E0B' : 'none'}
                      />
                    </button>

                    {isEditing ? (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); saveEdit(label.id, label.color) }}
                        className="rounded p-1"
                        style={{ color: '#22C55E' }}
                        title="Guardar"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(label.id, label.name) }}
                          className="rounded p-1 transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#283B56')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          title="Editar nombre"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(label.id, label.name) }}
                          className="rounded p-1"
                          style={{ color: '#EC1E2A' }}
                          title="Eliminar etiqueta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={labels.length}
          allSelected={allSelected}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onExit={exit}
          onDelete={handleBulkDelete}
          itemLabel="etiqueta"
        />
      )}
    </div>
  )
}
