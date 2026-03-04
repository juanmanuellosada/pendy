# PENDY — Project Specification

## 🎯 Project Overview

**Pendy** is a full-featured personal task management application with premium features. It runs on web, desktop (Tauri), and mobile (Capacitor) from a single React codebase, backed by Supabase.

**Philosophy:** Personal productivity app (no collaboration features, no karma/gamification). Fast, offline-capable, beautifully designed, feature-rich.

---

## 🎨 Brand Identity

### Colors

```
Primary (Dark Blue):  #283B56
Accent (Red):         #EC1E2A
White:                #FFFFFF
Background Light:     #F5F7FA
Background Dark:      #1A1F2B
Surface Dark:         #232A38
Text Primary:         #1A1A2E
Text Secondary:       #6B7280
Text Muted:           #9CA3AF
Border Light:         #E5E7EB
Border Dark:          #374151
Success:              #22C55E
Warning:              #F59E0B
Priority 1 (Urgent):  #EC1E2A
Priority 2 (High):    #F59E0B
Priority 3 (Medium):  #3B82F6
Priority 4 (Low):     #6B7280
```

### Logo

- File: `pendy-logo.png` (with white background)
- File: `pendy-logo-transparent.png` (transparent background)
- The logo is a dark blue rounded square with a white checkbox inside and a red checkmark

### Typography

- Primary Font: `Inter` (UI, body text)
- Monospace: `JetBrains Mono` (code, filters)

---

## 🛠 Tech Stack

### Frontend

- **Framework:** React 18+ with Vite
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (customized to brand colors)
- **State Management:** Zustand (global state) + TanStack Query (server state)
- **Routing:** React Router v6
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Date Handling:** date-fns (with es locale)
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation
- **Rich Text:** Tiptap (for comments)

### Backend

- **Platform:** Supabase
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Supabase Auth (email + Google OAuth)
- **Realtime:** Supabase Realtime (live sync across devices)
- **Storage:** Supabase Storage (attachments)
- **Edge Functions:** Supabase Edge Functions (Deno) for:
  - Natural language date parsing
  - Recurring task generation
  - Push notification scheduling
  - Reminders processing

### Multi-platform

- **Mobile:** Capacitor (iOS + Android wrapper over web app)
- **Desktop:** Tauri v2 (lightweight native desktop wrapper)

### Development

- **Package Manager:** pnpm
- **Linting:** ESLint + Prettier
- **Testing:** Vitest + Testing Library
- **Git Hooks:** Husky + lint-staged

---

## 📊 Database Schema

### Core Tables

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
  has_time BOOLEAN DEFAULT FALSE, -- whether due includes time
  duration_minutes INT, -- estimated duration
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- RRULE format (RFC 5545)
  recurrence_from TEXT DEFAULT 'due_date' CHECK (recurrence_from IN ('due_date', 'completion_date')),
  sort_order INT DEFAULT 0,
  depth INT DEFAULT 0, -- nesting level for subtasks
  collapsed BOOLEAN DEFAULT FALSE, -- collapse subtasks
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
  content TEXT NOT NULL, -- supports rich text (HTML from Tiptap)
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
  query TEXT NOT NULL, -- filter query string (e.g., "priority:1 & due:today")
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log (for undo and history)
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

### Indexes

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

### Row Level Security (RLS)

Every table MUST have RLS enabled. All policies follow the same pattern:

```sql
-- Users can only access their own data
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "[table]_select" ON [table] FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "[table]_insert" ON [table] FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "[table]_update" ON [table] FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "[table]_delete" ON [table] FOR DELETE USING (user_id = auth.uid());
```

### Database Functions

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

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_projects_modtime BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_sections_modtime BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_comments_modtime BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_modified_column();
```

---

## 📁 Project Structure

```
pendy/
├── CLAUDE.md
├── pendy-logo.png
├── pendy-logo-transparent.png
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── .env.local                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .eslintrc.cjs
├── .prettierrc
│
├── public/
│   ├── favicon.ico
│   ├── pendy-logo.png
│   └── manifest.json
│
├── src/
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Root component with providers
│   ├── index.css                 # Tailwind imports + global styles
│   │
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client initialization
│   │   ├── constants.ts          # App constants, colors, defaults
│   │   ├── utils.ts              # General utilities (cn, formatDate, etc.)
│   │   └── types.ts              # Global TypeScript types (from DB schema)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # Auth state and methods
│   │   ├── useTasks.ts           # Task CRUD + queries
│   │   ├── useProjects.ts        # Project CRUD + queries
│   │   ├── useSections.ts        # Section CRUD
│   │   ├── useLabels.ts          # Label CRUD
│   │   ├── useFilters.ts         # Filter CRUD + query execution
│   │   ├── useComments.ts        # Comment CRUD
│   │   ├── useReminders.ts       # Reminder CRUD
│   │   ├── useRealtimeSync.ts    # Supabase Realtime subscriptions
│   │   ├── useDragAndDrop.ts     # Drag & drop logic
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useTheme.ts           # Theme management (light/dark/system)
│   │
│   ├── stores/
│   │   ├── appStore.ts           # Global app state (sidebar, modals, etc.)
│   │   ├── taskStore.ts          # Task state + optimistic updates
│   │   └── uiStore.ts            # UI state (selected view, quick add open, etc.)
│   │
│   ├── services/
│   │   ├── taskService.ts        # Task business logic + Supabase calls
│   │   ├── projectService.ts     # Project business logic
│   │   ├── labelService.ts       # Label business logic
│   │   ├── filterService.ts      # Filter parsing + execution
│   │   ├── dateParser.ts         # Natural language date parsing (Spanish + English)
│   │   ├── recurrenceService.ts  # RRULE parsing + next occurrence calculation
│   │   ├── searchService.ts      # Full-text search across tasks
│   │   └── activityService.ts    # Activity logging for undo
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui base components (Button, Input, Dialog, etc.)
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     # Main layout with sidebar + content
│   │   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   │   ├── SidebarProject.tsx # Project item in sidebar (with drag)
│   │   │   ├── SidebarLabel.tsx  # Label item in sidebar
│   │   │   ├── SidebarFilter.tsx # Filter item in sidebar
│   │   │   ├── Header.tsx        # Top header with search + profile
│   │   │   └── MobileNav.tsx     # Bottom navigation for mobile
│   │   │
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx      # List of tasks (with sections)
│   │   │   ├── TaskItem.tsx      # Single task row (checkbox, title, labels, due, priority)
│   │   │   ├── TaskDetail.tsx    # Task detail panel (right sidebar or modal)
│   │   │   ├── TaskCheckbox.tsx  # Animated checkbox component
│   │   │   ├── TaskQuickAdd.tsx  # Quick add input (with NLP parsing)
│   │   │   ├── TaskEditor.tsx    # Full task editor (create/edit)
│   │   │   ├── SubtaskList.tsx   # Nested subtask display
│   │   │   ├── TaskDueDate.tsx   # Due date display + picker
│   │   │   ├── TaskPriority.tsx  # Priority flag selector
│   │   │   ├── TaskLabels.tsx    # Label pills display + selector
│   │   │   ├── TaskRecurrence.tsx # Recurrence rule selector
│   │   │   └── TaskDragHandle.tsx # Drag handle for reordering
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectView.tsx   # Project page (tasks + sections)
│   │   │   ├── ProjectHeader.tsx # Project title, options, view toggle
│   │   │   ├── ProjectEditor.tsx # Create/edit project dialog
│   │   │   └── SectionEditor.tsx # Create/edit section
│   │   │
│   │   ├── views/
│   │   │   ├── InboxView.tsx     # Inbox (uncategorized tasks)
│   │   │   ├── TodayView.tsx     # Tasks due today + overdue
│   │   │   ├── UpcomingView.tsx  # Calendar-style upcoming tasks
│   │   │   ├── FilterView.tsx    # Custom filter results
│   │   │   ├── LabelView.tsx     # Tasks with specific label
│   │   │   └── SearchView.tsx    # Search results
│   │   │
│   │   ├── filters/
│   │   │   ├── FilterEditor.tsx  # Create/edit custom filter
│   │   │   └── FilterBar.tsx     # Quick filter bar (priority, date, label)
│   │   │
│   │   ├── comments/
│   │   │   ├── CommentList.tsx   # Comments thread on a task
│   │   │   └── CommentEditor.tsx # Rich text comment input
│   │   │
│   │   ├── reminders/
│   │   │   └── ReminderPicker.tsx # Add/edit reminder
│   │   │
│   │   └── common/
│   │       ├── DatePicker.tsx    # Custom date picker with NLP input
│   │       ├── ColorPicker.tsx   # Color selector for projects/labels
│   │       ├── EmojiPicker.tsx   # Emoji picker for project icons
│   │       ├── SearchInput.tsx   # Global search input
│   │       ├── EmptyState.tsx    # Empty state illustrations
│   │       ├── LoadingState.tsx  # Loading skeletons
│   │       ├── ConfirmDialog.tsx # Confirmation dialog
│   │       └── Toast.tsx         # Toast notifications
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   │
│   │   ├── app/
│   │   │   ├── InboxPage.tsx
│   │   │   ├── TodayPage.tsx
│   │   │   ├── UpcomingPage.tsx
│   │   │   ├── ProjectPage.tsx
│   │   │   ├── LabelPage.tsx
│   │   │   ├── FilterPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   │
│   │   └── NotFoundPage.tsx
│   │
│   └── styles/
│       └── themes.ts             # Light/dark theme definitions
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_functions_triggers.sql
│   │   └── 004_indexes.sql
│   │
│   └── functions/
│       ├── parse-date/           # Natural language date parsing
│       │   └── index.ts
│       ├── process-reminders/    # Cron job for sending reminders
│       │   └── index.ts
│       └── generate-recurring/   # Generate next occurrence of recurring tasks
│           └── index.ts
│
├── capacitor/                    # Mobile (generated by Capacitor)
│   ├── capacitor.config.ts
│   ├── android/
│   └── ios/
│
└── src-tauri/                    # Desktop (generated by Tauri)
    ├── tauri.conf.json
    ├── src/
    └── icons/
```

---

## ⚡ Feature Specifications

### 1. Inbox + Today + Upcoming Views

**Inbox:** Default landing for tasks without a project or unsorted tasks. The inbox is a special project (is_inbox = true) auto-created per user.

**Today:** Shows all tasks due today + overdue tasks (past due_date, not completed). Grouped by: Overdue, today morning, today afternoon, today evening (if has_time).

**Upcoming:** Calendar-style view. Shows next 30 days. Each day shows tasks due on that day. Tasks without due_date are excluded. Option to toggle between "list" and "calendar grid" view.

### 2. Projects & Sub-projects

- Hierarchical tree structure (parent_id self-reference)
- Max 3 levels deep (project > sub-project > sub-sub-project)
- Each project has: name, color, icon (emoji), description, view_style (list/board)
- Projects appear in sidebar, collapsible
- Drag & drop to reorder projects and nest/unnest
- Archive projects (soft delete, tasks remain accessible)
- Special "Inbox" project cannot be deleted or archived

### 3. Sections within Projects

- Sections divide a project into groups (like "To Do", "In Progress", "Done")
- Tasks belong to a section within a project
- Sections can be reordered via drag & drop
- Sections can be collapsed
- Tasks can be dragged between sections

### 4. Tasks & Subtasks

- Title (required), description (optional, plain text or markdown)
- Priority (P1-P4, displayed as colored flags)
- Due date (date only or date+time)
- Labels (multiple)
- Project assignment
- Section assignment
- Subtasks (unlimited nesting via parent_id)
- Estimated duration (optional)
- Completion status with animation
- Sort order within section/project

### 5. Priorities (P1-P4)

| Priority | Label  | Color   | Flag |
| -------- | ------ | ------- | ---- |
| P1       | Urgent | #EC1E2A | 🔴   |
| P2       | High   | #F59E0B | 🟡   |
| P3       | Medium | #3B82F6 | 🔵   |
| P4       | Low    | #6B7280 | ⚪   |

Default priority for new tasks: P4.

### 6. Labels/Tags

- User-defined labels with name + color
- A task can have multiple labels
- Labels appear as colored pills on task items
- Filter tasks by label
- Labels in sidebar under "Labels" section
- Favorite labels appear at top

### 7. Natural Language Date Parsing

Parse strings like:

- "hoy", "mañana", "pasado mañana", "ayer"
- "lunes", "martes", ... (next occurrence)
- "en 3 días", "en 2 semanas", "en 1 mes"
- "15 de marzo", "15/03", "15-03-2026"
- "todos los lunes", "cada 2 semanas", "cada mes"
- "today", "tomorrow", "next monday", "in 3 days"

Implementation: Client-side parser first, with Edge Function fallback for complex cases.

### 8. Recurring Tasks

Use RRULE format (RFC 5545) stored in `recurrence_rule`:

- Daily: `RRULE:FREQ=DAILY;INTERVAL=1`
- Weekly on Monday: `RRULE:FREQ=WEEKLY;BYDAY=MO`
- Monthly on the 15th: `RRULE:FREQ=MONTHLY;BYMONTHDAY=15`
- Every 2 weeks: `RRULE:FREQ=WEEKLY;INTERVAL=2`

Two modes:

- **From due date:** Next occurrence calculated from original due_date
- **From completion date:** Next occurrence calculated from when task was completed

When a recurring task is completed, automatically create the next occurrence.

### 9. Reminders

- Reminders are independent of due dates
- Multiple reminders per task
- Types: push notification, email
- Reminder at: specific datetime
- Quick options: "At time of due date", "10 min before", "1 hour before", "1 day before"
- Edge Function cron job processes pending reminders

### 10. Comments & Attachments

**Comments:**

- Rich text (via Tiptap editor): bold, italic, links, bullet lists, code
- Threaded on each task
- Timestamp + edit/delete

**Attachments:**

- Upload files to Supabase Storage
- Attach to task or comment
- Image preview for image files
- File size limit: 25MB
- Accepted types: images, PDFs, documents, spreadsheets

### 11. Favorites

- Projects, labels, and filters can be marked as favorite
- Favorites appear in a dedicated sidebar section at the top
- Toggle favorite with star icon

### 12. Custom Filters & Filter Query Language

Saved filters with a custom query language:

```
# Priority filters
priority:1          → P1 tasks
priority:1,2        → P1 or P2 tasks

# Date filters
due:today           → Due today
due:tomorrow        → Due tomorrow
due:overdue         → Past due
due:nodate          → No due date
due:next7days       → Due within 7 days
due:before:2026-03-01

# Label filters
label:trabajo       → Has label "trabajo"
label:personal,casa → Has label "personal" or "casa"

# Project filters
project:MiProyecto  → In project "MiProyecto"

# Status
completed:false     → Not completed (default)
completed:true      → Completed

# Search
search:comprar      → Title contains "comprar"

# Combinators
&                   → AND
|                   → OR
!                   → NOT

# Examples
priority:1 & due:today
label:trabajo & !completed:true
(priority:1 | priority:2) & due:next7days
```

### 13. Quick Add

Global quick add triggered by keyboard shortcut (`Q` or `Ctrl+K`):

- Input field with NLP parsing
- Type: "Comprar leche mañana p1 #compras" →
  - Title: "Comprar leche"
  - Due: tomorrow
  - Priority: P1
  - Label: compras
- Parsing tokens:
  - `p1`-`p4` → priority
  - `#labelname` → label
  - `/projectname` → project
  - Date expressions → due_date
  - Everything else → title

### 14. Drag & Drop

Using @dnd-kit:

- Reorder tasks within a section/project
- Move tasks between sections
- Move tasks between projects (sidebar drop)
- Reorder projects in sidebar
- Reorder sections within a project
- Nest/unnest projects (indent/outdent)
- Nest/unnest subtasks

### 15. Themes & Visual Customization

- Light mode, Dark mode, System (auto)
- CSS variables for all theme colors
- Smooth transition between themes
- User preference saved in profile

### 16. Real-time Sync

- Supabase Realtime subscriptions on: tasks, projects, sections, labels
- Optimistic updates (update UI immediately, sync in background)
- Conflict resolution: last-write-wins
- Online/offline indicator
- Queue changes when offline, sync when back online (IndexedDB)

### 17. Search

- Full-text search across task titles and descriptions
- Fuzzy matching
- Results grouped by project
- Keyboard shortcut: `Ctrl+K` or `/`
- Recent searches saved locally

### 18. Keyboard Shortcuts

| Shortcut       | Action                   |
| -------------- | ------------------------ |
| `Q`            | Quick add task           |
| `Ctrl+K` / `/` | Search                   |
| `Ctrl+Z`       | Undo last action         |
| `1`-`4`        | Set priority (in editor) |
| `E`            | Edit selected task       |
| `Delete`       | Delete selected task     |
| `Space`        | Complete/uncomplete task |
| `↑` / `↓`      | Navigate tasks           |
| `→`            | Open task detail         |
| `←`            | Close task detail        |
| `G then I`     | Go to Inbox              |
| `G then T`     | Go to Today              |
| `G then U`     | Go to Upcoming           |

---

## 🤖 Agents & Skills

### Agent: Database Architect (`@db`)

**Responsibility:** Supabase schema, migrations, RLS policies, functions, triggers, indexes.
**Skills:**

- Write PostgreSQL migrations in `supabase/migrations/`
- Ensure ALL tables have RLS enabled with proper policies
- Create optimized indexes for query patterns
- Write database functions and triggers
- Handle Supabase Storage bucket creation and policies
- Configure Supabase Auth settings

**Rules:**

- Always use UUIDs as primary keys with `gen_random_uuid()`
- Always include `created_at` and `updated_at` on every table
- Always use `ON DELETE CASCADE` for user_id references
- Always enable RLS on every table, no exceptions
- Use `TIMESTAMPTZ` not `TIMESTAMP`
- Name migrations with sequential numbering: `001_`, `002_`, etc.

### Agent: UI Builder (`@ui`)

**Responsibility:** React components, pages, layouts, styling, animations, responsive design.
**Skills:**

- Build components using shadcn/ui base + Tailwind CSS
- Follow the brand colors defined in Brand Identity section
- Implement responsive design (mobile-first)
- Create smooth animations and transitions
- Build accessible components (ARIA labels, keyboard navigation)
- Implement dark/light theme with CSS variables

**Rules:**

- All components in TypeScript with proper types
- Use `cn()` utility for conditional class merging
- Mobile-first responsive: design for 375px, then scale up
- Every interactive element must have hover/focus/active states
- Use Lucide React for all icons
- Use `date-fns` with `es` locale for date formatting
- Animations: use Tailwind's `transition-*` or CSS `@keyframes`
- Checkbox completion animation: scale + fade to green + strikethrough text
- Sidebar collapsible on mobile (slide from left)
- Task detail as right panel on desktop, full page on mobile

### Agent: Business Logic (`@logic`)

**Responsibility:** Services, state management, NLP parsing, filter engine, recurrence handling.
**Skills:**

- Implement Zustand stores with proper selectors
- Build TanStack Query hooks for server state
- Write the natural language date parser (Spanish + English)
- Implement the filter query language parser and executor
- Handle RRULE recurrence logic
- Implement Quick Add tokenizer and parser
- Build optimistic update patterns
- Implement undo/redo via activity log

**Rules:**

- All service functions are pure when possible
- Zustand stores: minimal state, computed values as selectors
- TanStack Query: use `queryKey` factories for consistency
- Optimistic updates: update cache immediately, rollback on error
- NLP parser: client-side first, no API calls for common patterns
- Filter parser: return a Supabase query builder, not raw SQL
- RRULE: use `rrule` npm package for RFC 5545 compliance

### Agent: Sync & Infrastructure (`@sync`)

**Responsibility:** Realtime sync, offline support, auth flow, Edge Functions.
**Skills:**

- Configure Supabase Realtime channels
- Implement offline queue with IndexedDB
- Build auth flow (login, register, OAuth, forgot password)
- Write Edge Functions in Deno/TypeScript
- Configure Capacitor for mobile builds
- Configure Tauri for desktop builds

**Rules:**

- Realtime: subscribe to user-specific channels only
- Offline: use IndexedDB to queue mutations, replay on reconnect
- Auth: always redirect to login if session expired
- Edge Functions: validate auth token in every function
- Push notifications: use Capacitor Push Notifications plugin
- Desktop: Tauri commands for native features (notifications, system tray)

### Agent: Testing (`@test`)

**Responsibility:** Unit tests, integration tests, component tests.
**Skills:**

- Write Vitest unit tests for services and utilities
- Write Testing Library tests for components
- Test filter parser with edge cases
- Test date NLP parser with Spanish and English inputs
- Test recurrence logic

**Rules:**

- Test file naming: `*.test.ts` or `*.test.tsx`
- Test directory mirrors `src/` structure
- Minimum: test all services, parsers, and core components
- Use `describe` + `it` pattern
- Mock Supabase calls in service tests

---

## 🚀 Implementation Phases

### Phase 1 — MVP Foundation (Week 1-2)

**Goal:** Usable task manager with basic features.

1. Project setup (Vite + React + Tailwind + shadcn/ui + Supabase)
2. Auth (login, register, forgot password)
3. Database migrations (all tables, RLS, functions)
4. Sidebar layout + routing
5. Inbox view + basic task CRUD
6. Task creation with title, priority, due date
7. Task completion with animation
8. Today view (due today + overdue)
9. Upcoming view (next 30 days)
10. Projects CRUD (create, edit, delete, archive)
11. Basic theme (light + dark)
12. Responsive design (mobile + desktop)

### Phase 2 — Power Features (Week 3-4)

**Goal:** Advanced task management features.

1. Subtasks (unlimited nesting)
2. Sections within projects
3. Labels/tags CRUD + assignment to tasks
4. Drag & drop (reorder tasks, sections, projects)
5. Task detail panel (right sidebar)
6. Task description (markdown)
7. Sub-projects (nesting projects)
8. Favorites (projects, labels, filters)
9. Board view for projects (Kanban-style)
10. Keyboard shortcuts

### Phase 3 — Premium Features (Week 5-6)

**Goal:** Differentiate with premium-level features.

1. Natural language date parsing (Spanish + English)
2. Quick Add with NLP tokenizer
3. Recurring tasks (RRULE)
4. Comments on tasks (rich text with Tiptap)
5. File attachments (Supabase Storage)
6. Reminders (push + email)
7. Custom filter query language
8. Saved filters
9. Search (full-text across tasks)
10. Activity log + undo

### Phase 4 — Multi-platform (Week 7-8)

**Goal:** Ship on all platforms.

1. Capacitor setup + mobile build (iOS + Android)
2. Mobile-specific UI adjustments
3. Push notifications (Capacitor plugin)
4. Tauri setup + desktop build
5. System tray integration (desktop)
6. Auto-update (Tauri updater)
7. Offline support (IndexedDB + sync queue)
8. Real-time sync (Supabase Realtime)

### Phase 5 — Polish & Optimization (Week 9-10)

**Goal:** Production-ready quality.

1. Onboarding flow for new users
2. Settings page (all preferences)
3. Import/Export data (CSV/JSON)
4. Export data
5. Performance optimization (virtualized lists, lazy loading)
6. PWA support (service worker, installable)
7. Error boundaries + error handling
8. Loading states + skeleton screens
9. Empty states with illustrations
10. Final responsive polish + accessibility audit

---

## 📝 Coding Conventions

### General

- Language: TypeScript strict mode, no `any`
- Formatting: Prettier (2 spaces, single quotes, trailing commas)
- Naming: camelCase for variables/functions, PascalCase for components/types
- Files: kebab-case for file names, PascalCase for component files
- Exports: named exports preferred, default export only for pages

### React

- Functional components only
- Custom hooks for all data fetching and business logic
- Props interfaces named `{ComponentName}Props`
- Destructure props in function signature
- Use `React.memo()` for list item components
- Use `useCallback` and `useMemo` where performance matters

### State Management

- Server state: TanStack Query (fetch, cache, sync)
- Client state: Zustand (UI state, app state)
- Form state: React Hook Form
- URL state: React Router search params

### CSS/Tailwind

- Use Tailwind classes directly in JSX
- Use `cn()` utility for conditional classes
- Extract repeated patterns into components, not CSS classes
- CSS variables for theme colors in `index.css`
- Mobile-first breakpoints: `sm:` `md:` `lg:` `xl:`

### Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `test:`
- Branch naming: `feat/task-crud`, `fix/date-parser`, `refactor/sidebar`
- Commit messages in English

---

## ⚠️ Important Rules

1. **NEVER skip RLS policies.** Every table must have RLS enabled.
2. **NEVER hardcode Supabase credentials.** Always use environment variables.
3. **ALWAYS handle loading, error, and empty states** for every data-fetching component.
4. **ALWAYS use optimistic updates** for task operations (complete, reorder, edit).
5. **ALWAYS support keyboard navigation** for core task operations.
6. **ALWAYS test on mobile viewport** (375px) after building any component.
7. **ALWAYS use TypeScript types** — no implicit any, no type assertions unless absolutely necessary.
8. **ALWAYS use date-fns** for date manipulation — never raw Date operations.
9. **ALWAYS support Spanish** as primary language with English fallback.
10. **ALL user-facing text must be in Spanish** (UI labels, placeholders, messages).
