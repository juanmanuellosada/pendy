import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Calendar,
  CalendarPlus,
  Plus,
  ChevronDown,
  ChevronRight,
  Hash,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
  CheckCircle2,
  Inbox,
  GripVertical,
  Repeat,
} from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useProjects, useUpdateProject, useReorderProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useUIStore } from '@/stores/uiStore'
import { useAppStore } from '@/stores/appStore'
import { useCalendarIntegrations } from '@/hooks/useCalendarIntegrations'
import { useTodayTasks, useTaskCountsByProject } from '@/hooks/useTasks'
import { useTodayHabits, useHabitCompletions } from '@/hooks/useHabits'
import { useLabels } from '@/hooks/useLabels'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectNode = Project & { children: ProjectNode[]; depth: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(projects: Project[]): ProjectNode[] {
  const map = new Map<string, ProjectNode>()
  for (const p of projects) map.set(p.id, { ...p, children: [], depth: 0 })

  const roots: ProjectNode[] = []
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNode = (n: ProjectNode) => {
    n.children.sort((a, b) => a.sort_order - b.sort_order)
    n.children.forEach(sortNode)
  }
  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(sortNode)
  return roots
}

function isDescendantOf(projects: Project[], targetId: string, ancestorId: string): boolean {
  const target = projects.find((p) => p.id === targetId)
  if (!target || !target.parent_id) return false
  if (target.parent_id === ancestorId) return true
  return isDescendantOf(projects, target.parent_id, ancestorId)
}

function getProjectDepth(projects: Project[], id: string): number {
  const project = projects.find((p) => p.id === id)
  if (!project || !project.parent_id) return 0
  return 1 + getProjectDepth(projects, project.parent_id)
}

// ─── ProjectTreeItem ──────────────────────────────────────────────────────────

interface ProjectTreeItemProps {
  project: ProjectNode
  projectCounts: Record<string, number>
  nestTargetId: string | null
  dragActiveId: string | null
  collapsedIds: Set<string>
  toggleCollapsed: (id: string) => void
  onNavigate: (path: string) => void
  onAddSubproject: (parentId: string) => void
  currentPath: string
}

function ProjectTreeItem({
  project,
  projectCounts,
  nestTargetId,
  dragActiveId,
  collapsedIds,
  toggleCollapsed,
  onNavigate,
  onAddSubproject,
  currentPath,
}: ProjectTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: project.id,
  })
  const { setNodeRef: setDropRef } = useDroppable({ id: project.id })

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node)
      setDropRef(node)
    },
    [setDragRef, setDropRef],
  )

  const isActive = currentPath === `/app/project/${project.id}`
  const isCollapsed = collapsedIds.has(project.id)
  const count = projectCounts[project.id] ?? 0
  const isNestTarget = nestTargetId === project.id && dragActiveId !== project.id
  const hasChildren = project.children.length > 0

  return (
    <div style={{ opacity: isDragging ? 0.4 : 1 }}>
      <div
        ref={setRef}
        className={cn(
          'group relative flex items-center gap-1 rounded-lg py-1.5 pr-2 text-sm transition-colors',
          isActive ? 'font-medium' : 'hover:opacity-90',
          isNestTarget && 'ring-2 ring-blue-500',
        )}
        style={{
          paddingLeft: `${8 + project.depth * 16}px`,
          backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
        onClick={() => onNavigate(`/app/project/${project.id}`)}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-50 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          title="Arrastrar para reordenar"
        >
          <GripVertical size={12} style={{ color: 'var(--text-muted)' }} />
        </span>

        {/* Collapse toggle o spacer */}
        {hasChildren ? (
          <button
            className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapsed(project.id)
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}

        {/* Icono de color */}
        <Hash size={14} style={{ color: project.color, flexShrink: 0 }} />

        {/* Nombre */}
        <span className="flex-1 truncate text-left">{project.name}</span>

        {/* Contador de tareas */}
        {count > 0 && (
          <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {count}
          </span>
        )}

        {/* Botón añadir subproyecto (solo si depth < 2 y no es inbox) */}
        {project.depth < 2 && !project.is_inbox && (
          <button
            className="flex-shrink-0 rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:!opacity-100"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-active)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onClick={(e) => {
              e.stopPropagation()
              onAddSubproject(project.id)
            }}
            title="Añadir subproyecto"
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Hijos recursivos */}
      {!isCollapsed &&
        project.children.map((child) => (
          <ProjectTreeItem
            key={child.id}
            project={child}
            projectCounts={projectCounts}
            nestTargetId={nestTargetId}
            dragActiveId={dragActiveId}
            collapsedIds={collapsedIds}
            toggleCollapsed={toggleCollapsed}
            onNavigate={onNavigate}
            onAddSubproject={onAddSubproject}
            currentPath={currentPath}
          />
        ))}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { data: projects = [] } = useProjects()
  const { setProjectEditorOpen, setNewProjectParentId, getViewOptions } = useUIStore()
  const { sidebarCollapsed, setSidebarOpen, setQuickAddOpen, setEventEditorOpen } = useAppStore()
  const { isDark, setTheme } = useTheme()
  const { data: integrations = [] } = useCalendarIntegrations()
  const isCalendarConnected = integrations.length > 0
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)

  const { data: todayTasks = [] } = useTodayTasks()
  const { data: projectCounts = {} } = useTaskCountsByProject()
  const { data: todayHabits = [] } = useTodayHabits()
  const todayDateKey = new Date().toISOString().slice(0, 10)
  const { data: habitCompletions = [] } = useHabitCompletions(todayDateKey, todayDateKey)
  const todayViewOpts = getViewOptions('today')
  const showHabitsInToday = todayViewOpts.showHabits ?? true
  const pendingHabitsCount = showHabitsInToday
    ? todayHabits.filter(
        (h) =>
          !habitCompletions.some((c) => c.habit_id === h.id && c.completed_date === todayDateKey),
      ).length
    : 0
  const todayCount = todayTasks.filter((t) => !t.is_completed).length + pendingHabitsCount

  const { data: labels = [] } = useLabels()
  const favoriteLabels = labels.filter((l) => l.is_favorite)

  const regularProjects = projects.filter((p) => !p.is_inbox && !p.is_archived)
  const favoriteProjects = projects.filter((p) => p.is_favorite && !p.is_archived)

  // ── DnD state ────────────────────────────────────────────────────────────

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [nestTargetId, setNestTargetId] = useState<string | null>(null)
  const nestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastOverRef = useRef<string | null>(null)

  const updateProject = useUpdateProject()
  const reorderProjects = useReorderProjects()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const tree = buildTree(regularProjects)

  const toggleCollapsed = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleAddSubproject = (parentId: string) => {
    setNewProjectParentId(parentId)
    setProjectEditorOpen(true)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDragActiveId(active.id as string)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    const overId = over ? (over.id as string) : null
    if (overId === lastOverRef.current) return
    lastOverRef.current = overId

    if (nestTimerRef.current) clearTimeout(nestTimerRef.current)
    setNestTargetId(null)

    if (overId && overId !== dragActiveId) {
      nestTimerRef.current = setTimeout(() => setNestTargetId(overId), 400)
    }
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (nestTimerRef.current) clearTimeout(nestTimerRef.current)

    const activeId = active.id as string

    if (nestTargetId && nestTargetId !== activeId) {
      const targetDepth = getProjectDepth(regularProjects, nestTargetId)
      const targetProject = regularProjects.find((p) => p.id === nestTargetId)
      const canNest =
        targetProject &&
        !targetProject.is_inbox &&
        targetDepth < 2 &&
        !isDescendantOf(regularProjects, nestTargetId, activeId)

      if (canNest) {
        updateProject.mutate({ id: activeId, updates: { parent_id: nestTargetId } })
      }
    } else if (over && activeId !== (over.id as string)) {
      const overId = over.id as string
      const activeP = regularProjects.find((p) => p.id === activeId)
      const overP = regularProjects.find((p) => p.id === overId)

      if (activeP && overP && activeP.parent_id === overP.parent_id) {
        const siblings = regularProjects
          .filter((p) => p.parent_id === activeP.parent_id)
          .sort((a, b) => a.sort_order - b.sort_order)
        const oldIdx = siblings.findIndex((p) => p.id === activeId)
        const newIdx = siblings.findIndex((p) => p.id === overId)

        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(siblings, oldIdx, newIdx)
          reorderProjects.mutate(reordered.map((p, i) => ({ id: p.id, sort_order: i })))
        }
      }
    }

    setDragActiveId(null)
    setNestTargetId(null)
    lastOverRef.current = null
  }

  const handleDragCancel = () => {
    if (nestTimerRef.current) clearTimeout(nestTimerRef.current)
    setDragActiveId(null)
    setNestTargetId(null)
    lastOverRef.current = null
  }

  const navItems = [
    { icon: Inbox, label: 'Bandeja de entrada', path: '/app/inbox', shortcut: 'I' },
    { icon: CalendarDays, label: 'Hoy', path: '/app/today', shortcut: 'H' },
    { icon: Calendar, label: 'Próximo', path: '/app/upcoming', shortcut: 'P' },
    { icon: Repeat, label: 'Hábitos', path: '/app/habits', shortcut: 'A' },
    { icon: CheckCircle2, label: 'Completado', path: '/app/completed', shortcut: 'C' },
  ]

  const handleNav = (path: string) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  // ── Collapsed sidebar ─────────────────────────────────────────────────────

  if (sidebarCollapsed) {
    return (
      <div
        className="flex h-full flex-col items-center py-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <img
          src={`${import.meta.env.BASE_URL}pendy-logo.png`}
          alt="Pendy"
          className="h-8 w-8 rounded-lg"
        />
        <div className="mt-4 flex flex-col gap-1">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="rounded-lg p-2.5 transition-colors"
            style={{ backgroundColor: '#EC1E2A', color: '#FFFFFF' }}
            title="Añadir tarea (Q)"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => isCalendarConnected && setEventEditorOpen(true)}
            disabled={!isCalendarConnected}
            className="rounded-lg p-2.5 transition-colors"
            style={{
              backgroundColor: '#283B56',
              color: '#FFFFFF',
              opacity: isCalendarConnected ? 1 : 0.4,
              cursor: isCalendarConnected ? 'pointer' : 'not-allowed',
            }}
            title={
              isCalendarConnected
                ? 'Añadir evento (E)'
                : 'Conecta un calendario para añadir eventos'
            }
          >
            <CalendarPlus size={20} />
          </button>
          <button
            onClick={() => handleNav('/app/search')}
            className="rounded-lg p-2.5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Buscador (S)"
          >
            <Search size={20} />
          </button>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {navItems.map(({ icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className="rounded-lg p-2.5 transition-colors"
              style={{
                backgroundColor: location.pathname === path ? '#283B56' : 'transparent',
                color: location.pathname === path ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              <Icon size={20} />
            </button>
          ))}
        </nav>
      </div>
    )
  }

  // ── Full sidebar ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <img
          src={`${import.meta.env.BASE_URL}pendy-logo.png`}
          alt="Pendy"
          className="h-8 w-8 rounded-lg"
        />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {profile?.full_name || 'Usuario'}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        {/* Añadir tarea */}
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#EC1E2A', color: '#FFFFFF' }}
        >
          <Plus size={18} />
          <span className="flex-1 text-left">Añadir tarea</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
          >
            Q
          </span>
        </button>

        {/* Añadir evento */}
        <button
          onClick={() => isCalendarConnected && setEventEditorOpen(true)}
          disabled={!isCalendarConnected}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all"
          style={{
            backgroundColor: '#283B56',
            color: '#FFFFFF',
            opacity: isCalendarConnected ? 1 : 0.4,
            cursor: isCalendarConnected ? 'pointer' : 'not-allowed',
          }}
          title={
            isCalendarConnected
              ? undefined
              : 'Conecta un calendario en Configuración para añadir eventos'
          }
        >
          <CalendarPlus size={18} />
          <span className="flex-1 text-left">Añadir evento</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
          >
            E
          </span>
        </button>

        {/* Buscador */}
        <button
          onClick={() => handleNav('/app/search')}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            location.pathname === '/app/search' ? 'text-white' : 'hover:opacity-80',
          )}
          style={{
            backgroundColor: location.pathname === '/app/search' ? '#283B56' : 'transparent',
            color: location.pathname === '/app/search' ? '#FFFFFF' : 'var(--text-primary)',
          }}
        >
          <Search size={18} />
          <span className="flex-1 text-left">Buscador</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              opacity: location.pathname === '/app/search' ? 0.7 : 1,
            }}
          >
            S
          </span>
        </button>

        {/* Separador */}
        <div className="my-1 mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

        {/* Nav items */}
        {navItems.map(({ icon: Icon, label, path, shortcut }) => {
          const isToday = path === '/app/today'
          const count = isToday ? todayCount : 0
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                location.pathname === path ? 'text-white' : 'hover:opacity-80',
              )}
              style={{
                backgroundColor: location.pathname === path ? '#283B56' : 'transparent',
                color: location.pathname === path ? '#FFFFFF' : 'var(--text-primary)',
              }}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{label}</span>
              {count > 0 && (
                <span
                  className="min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold"
                  style={{
                    backgroundColor:
                      location.pathname === path ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                    color: location.pathname === path ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  {count}
                </span>
              )}
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-muted)',
                  opacity: location.pathname === path ? 0.7 : 1,
                }}
              >
                {shortcut}
              </span>
            </button>
          )
        })}
      </div>

      {/* Scrollable: Favoritos + Proyectos */}
      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        {/* Favoritos: proyectos + etiquetas */}
        {(favoriteProjects.length > 0 || favoriteLabels.length > 0) && (
          <div className="mt-4">
            <div className="flex items-center px-3 py-1">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Favoritos
              </span>
            </div>

            {/* Proyectos favoritos (flat, sin árbol) */}
            {favoriteProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleNav(`/app/project/${project.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === `/app/project/${project.id}` ? 'font-medium' : '',
                )}
                style={{
                  backgroundColor:
                    location.pathname === `/app/project/${project.id}`
                      ? 'var(--bg-active)'
                      : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <Hash size={16} style={{ color: project.color }} />
                <span className="truncate">{project.name}</span>
              </button>
            ))}

            {/* Etiquetas favoritas */}
            {favoriteLabels.map((label) => (
              <button
                key={label.id}
                onClick={() => handleNav(`/app/label/${label.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === `/app/label/${label.id}` ? 'font-medium' : '',
                )}
                style={{
                  backgroundColor:
                    location.pathname === `/app/label/${label.id}`
                      ? 'var(--bg-active)'
                      : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="truncate">{label.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mis proyectos — árbol con DnD */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-3 py-1">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center gap-1"
            >
              {projectsExpanded ? (
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              )}
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Mis proyectos
              </span>
            </button>
            <button
              onClick={() => setProjectEditorOpen(true)}
              className="rounded p-1 transition-colors hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Nuevo proyecto"
            >
              <Plus size={16} />
            </button>
          </div>

          {projectsExpanded && (
            <div className="mt-1 flex flex-col gap-0.5">
              {regularProjects.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sin proyectos
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  {tree.map((node) => (
                    <ProjectTreeItem
                      key={node.id}
                      project={node}
                      projectCounts={projectCounts}
                      nestTargetId={nestTargetId}
                      dragActiveId={dragActiveId}
                      collapsedIds={collapsedIds}
                      toggleCollapsed={toggleCollapsed}
                      onNavigate={handleNav}
                      onAddSubproject={handleAddSubproject}
                      currentPath={location.pathname}
                    />
                  ))}

                  <DragOverlay>
                    {dragActiveId ? (
                      <div
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderColor: 'var(--border-primary)',
                          color: 'var(--text-primary)',
                          opacity: 0.95,
                        }}
                      >
                        <Hash
                          size={14}
                          style={{
                            color:
                              regularProjects.find((p) => p.id === dragActiveId)?.color ??
                              '#283B56',
                          }}
                        />
                        <span className="truncate">
                          {regularProjects.find((p) => p.id === dragActiveId)?.name}
                        </span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          )}
        </div>

        {/* Etiquetas */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-3 py-1">
            <button
              onClick={() => setLabelsExpanded(!labelsExpanded)}
              className="flex items-center gap-1"
            >
              {labelsExpanded ? (
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              )}
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Etiquetas
              </span>
            </button>
            <button
              onClick={() => handleNav('/app/labels')}
              className="rounded p-1 transition-colors hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Gestionar etiquetas"
            >
              <Settings size={14} />
            </button>
          </div>

          {labelsExpanded && (
            <div className="mt-1 flex flex-col gap-0.5">
              {labels.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sin etiquetas
                </p>
              ) : (
                labels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => handleNav(`/app/label/${label.id}`)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      location.pathname === `/app/label/${label.id}`
                        ? 'font-medium'
                        : 'hover:opacity-80',
                    )}
                    style={{
                      backgroundColor:
                        location.pathname === `/app/label/${label.id}`
                          ? 'var(--bg-active)'
                          : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 truncate text-left">{label.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-2 py-3" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => handleNav('/app/settings')}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
