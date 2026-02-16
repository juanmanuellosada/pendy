export const themes = {
  light: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F5F7FA',
    bgTertiary: '#F0F2F5',
    bgHover: '#F5F7FA',
    bgActive: '#EDF0F4',
    bgSidebar: '#FAFBFC',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    borderPrimary: '#E5E7EB',
    borderSecondary: '#F3F4F6',
  },
  dark: {
    bgPrimary: '#1A1F2B',
    bgSecondary: '#232A38',
    bgTertiary: '#2A3244',
    bgHover: '#2A3244',
    bgActive: '#323C50',
    bgSidebar: '#161B26',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    borderPrimary: '#374151',
    borderSecondary: '#2A3244',
  },
} as const

export type ThemeMode = 'light' | 'dark' | 'system'
