export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      projects: {
        Row: Project
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Project, 'id' | 'user_id'>>
      }
      sections: {
        Row: Section
        Insert: Omit<Section, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Section, 'id' | 'user_id'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Task, 'id' | 'user_id'>>
      }
      labels: {
        Row: Label
        Insert: Omit<Label, 'id' | 'created_at'>
        Update: Partial<Omit<Label, 'id' | 'user_id'>>
      }
      task_labels: {
        Row: TaskLabel
        Insert: TaskLabel
        Update: Partial<TaskLabel>
      }
      comments: {
        Row: Comment
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Comment, 'id' | 'user_id'>>
      }
      attachments: {
        Row: Attachment
        Insert: Omit<Attachment, 'id' | 'created_at'>
        Update: Partial<Omit<Attachment, 'id' | 'user_id'>>
      }
      reminders: {
        Row: Reminder
        Insert: Omit<Reminder, 'id' | 'created_at'>
        Update: Partial<Omit<Reminder, 'id' | 'user_id'>>
      }
      filters: {
        Row: Filter
        Insert: Omit<Filter, 'id' | 'created_at'>
        Update: Partial<Omit<Filter, 'id' | 'user_id'>>
      }
      activity_log: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at'>
        Update: never
      }
    }
  }
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  timezone: string
  theme: 'light' | 'dark' | 'system'
  language: string
  date_format: string
  time_format: '12h' | '24h'
  start_of_week: number
  default_view: 'inbox' | 'today' | 'upcoming'
  quick_add_default_project: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  description: string | null
  color: string
  icon: string | null
  is_favorite: boolean
  is_archived: boolean
  is_inbox: boolean
  view_style: 'list' | 'board'
  sort_order: number
  collapsed: boolean
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  user_id: string
  project_id: string
  name: string
  sort_order: number
  collapsed: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string
  section_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  priority: 1 | 2 | 3 | 4
  due_date: string | null
  due_datetime: string | null
  has_time: boolean
  duration_minutes: number | null
  is_completed: boolean
  completed_at: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_from: 'due_date' | 'completion_date'
  deadline: string | null
  sort_order: number
  depth: number
  collapsed: boolean
  created_at: string
  updated_at: string
}

export interface Label {
  id: string
  user_id: string
  name: string
  color: string
  is_favorite: boolean
  sort_order: number
  created_at: string
}

export interface TaskLabel {
  task_id: string
  label_id: string
}

export interface Comment {
  id: string
  user_id: string
  task_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  user_id: string
  task_id: string | null
  comment_id: string | null
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  task_id: string
  remind_at: string
  type: 'push' | 'email'
  is_sent: boolean
  created_at: string
}

export interface Filter {
  id: string
  user_id: string
  name: string
  query: string
  color: string
  icon: string | null
  is_favorite: boolean
  sort_order: number
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  action: string
  changes: Record<string, { old: unknown; new: unknown }> | null
  created_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  color: string
  icon: string | null
  duration_minutes: number    // duración en minutos, default 30
  scheduled_time: string | null  // hora global por defecto 'HH:mm:ss', null = sin hora
  recurrence_type: 'daily' | 'times_per_week' | 'specific_days'
  times_per_week: number | null
  specific_days: number[]     // 0=Dom, 1=Lun ... 6=Sab
  is_active: boolean
  is_archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HabitSchedule {
  id: string
  user_id: string
  habit_id: string
  scheduled_date: string  // 'yyyy-MM-dd'
  scheduled_time: string  // 'HH:mm:ss'
  created_at: string
}

export interface HabitCompletion {
  id: string
  user_id: string
  habit_id: string
  completed_date: string  // 'yyyy-MM-dd'
  created_at: string
}

export interface CalendarIntegration {
  id: string
  user_id: string
  provider: 'google' | 'outlook'
  access_token: string
  refresh_token: string | null
  token_expiry: string
  email: string | null
  is_active: boolean
  selected_calendar_ids: string[]
  created_at: string
  updated_at: string
}

export interface GoogleCalendarListEntry {
  id: string
  summary: string
  backgroundColor?: string
  primary?: boolean
  accessRole?: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
}

export interface CalendarEventReminder {
  method: 'popup' | 'email'
  minutes: number
}

export interface CalendarEvent {
  id: string
  provider: 'google'
  title: string
  start: Date
  end: Date
  isAllDay: boolean
  location?: string
  description?: string
  htmlLink?: string
  calendarId?: string
  calendarName?: string
  calendarColor?: string
  recurringEventId?: string   // presente en instancias de eventos recurrentes
  recurrenceText?: string     // descripción legible de la regla de recurrencia
  recurrence?: string[]       // líneas RRULE
  reminders?: CalendarEventReminder[]
}
