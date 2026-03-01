import type { Project } from '@/lib/types'

export type ProjectNode = Project & { children: ProjectNode[]; depth: number }

export function buildProjectTree(projects: Project[]): ProjectNode[] {
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

export function flattenProjectTree(nodes: ProjectNode[]): ProjectNode[] {
  const result: ProjectNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children.length > 0) result.push(...flattenProjectTree(node.children))
  }
  return result
}
