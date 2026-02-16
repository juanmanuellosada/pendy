export const COLORS = {
  primary: '#283B56',
  accent: '#EC1E2A',
  white: '#FFFFFF',
  bgLight: '#F5F7FA',
  bgDark: '#1A1F2B',
  surfaceDark: '#232A38',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  borderLight: '#E5E7EB',
  borderDark: '#374151',
  success: '#22C55E',
  warning: '#F59E0B',
} as const

export const PRIORITY_COLORS: Record<number, string> = {
  1: '#EC1E2A',
  2: '#F59E0B',
  3: '#3B82F6',
  4: '#6B7280',
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgente',
  2: 'Alta',
  3: 'Media',
  4: 'Baja',
}

export const PROJECT_COLORS = [
  '#283B56', '#EC1E2A', '#F59E0B', '#22C55E', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
  '#84CC16', '#06B6D4', '#E11D48', '#7C3AED', '#0EA5E9',
] as const

export const DEFAULT_PROJECT_COLOR = '#283B56'
export const MAX_PROJECT_DEPTH = 3
export const UPCOMING_DAYS = 30
