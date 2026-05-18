# Pendy — Database Schema

Full PostgreSQL schema for Supabase. See `.claude/rules/database.md` for coding conventions.

---

## Core Tables

```sql
-- Users profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'es',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
  start_of_week INT DEFAULT 1, -- 0=Sunday, 1=Monday
  default_view TEXT DEFAULT 'today' CHECK (default_view IN ('inbox', 'today', 'upcoming')),
  quick_add_default_project UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#283B56',
  icon TEXT, -- emoji or lucide icon name
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_inbox BOOLEAN DEFAULT FALSE, -- only one per user
  view_style TEXT DEFAULT 'list' CHECK (view_style IN ('list', 'board')),
  sort_order INT DEFAULT 0,
  collapsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sections within projects
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  collapsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- subtask support
  title TEXT NOT NULL,
  description TEXT,
  priority INT DEFAULT 4 CHECK (priority BETWEEN 1 AND 4), -- 1=urgent, 4=low
  due_date DATE,
  due_datetime TIMESTAMPTZ, -- if task has specific time
  has_time BOOLEAN DEFAULT FALSE,
  duration_minutes INT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- RRULE format (RFC 5545)
  recurrence_from TEXT DEFAULT 'due_date' CHECK (recurrence_from IN ('due_date', 'completion_date')),
  sort_order INT DEFAULT 0,
  depth INT DEFAULT 0, -- nesting level for subtasks
  collapsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labels/Tags
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task-Label junction (many-to-many)
CREATE TABLE task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Comments on tasks
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- rich text HTML from Tiptap
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File attachments (on tasks or comments)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- path in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'push' CHECK (type IN ('push', 'email')),
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Filters (saved filter queries)
CREATE TABLE filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL, -- filter query string e.g. "priority:1 & due:today"
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log (undo + history)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'task', 'project', 'section', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'completed', 'deleted', 'moved'
  changes JSONB, -- { field: { old: ..., new: ... } }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Indexes

```sql
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_section_id ON tasks(section_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_due_date ON tasks(user_id, due_date) WHERE NOT is_completed;
CREATE INDEX idx_tasks_completed ON tasks(user_id, is_completed);
CREATE INDEX idx_tasks_priority ON tasks(user_id, priority) WHERE NOT is_completed;
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_sections_project_id ON sections(project_id);
CREATE INDEX idx_labels_user_id ON labels(user_id);
CREATE INDEX idx_task_labels_task ON task_labels(task_id);
CREATE INDEX idx_task_labels_label ON task_labels(label_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_reminders_pending ON reminders(user_id, remind_at) WHERE NOT is_sent;
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
```

---

## Row Level Security (RLS)

Every table MUST have RLS enabled. All policies follow this pattern:

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "[table]_select" ON [table] FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "[table]_insert" ON [table] FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "[table]_update" ON [table] FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "[table]_delete" ON [table] FOR DELETE USING (user_id = auth.uid());
```

---

## Database Functions & Triggers

```sql
-- Auto-create inbox project for new users
CREATE OR REPLACE FUNCTION create_default_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO projects (user_id, name, is_inbox, color, icon)
  VALUES (NEW.id, 'Inbox', true, '#283B56', 'inbox');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_project();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime  BEFORE UPDATE ON profiles  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_projects_modtime  BEFORE UPDATE ON projects  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_tasks_modtime     BEFORE UPDATE ON tasks     FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_sections_modtime  BEFORE UPDATE ON sections  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_comments_modtime  BEFORE UPDATE ON comments  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
```

---

## Migration Files

Located in `supabase/migrations/`, named sequentially:

| File                             | Contents                        |
| -------------------------------- | ------------------------------- |
| `001_initial_schema.sql`         | All table definitions           |
| `002_rls_policies.sql`           | RLS enable + all policies       |
| `003_functions_triggers.sql`     | Functions + triggers            |
| `004_indexes.sql`                | All indexes                     |
| `005_add_deadline_to_tasks.sql`  | Deadline column                 |
| `006_calendar_integrations.sql`  | Calendar integration tables     |
| `007_calendar_selected_ids.sql`  | Selected calendar IDs           |
| `008_push_subscriptions.sql`     | Push notification subscriptions |
| `009_habits.sql`                 | Habits feature tables           |
| `010_update_habits.sql`          | Habits schema updates           |
| `011_enable_realtime.sql`        | Realtime publication config     |
| `012_calendar_sync_metadata.sql` | Calendar sync metadata          |
