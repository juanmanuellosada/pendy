# Pendy — Feature Specifications

## 1. Inbox + Today + Upcoming Views

**Inbox:** Default landing for tasks without a project or unsorted tasks. The inbox is a special
project (`is_inbox = true`) auto-created per user.

**Today:** Shows all tasks due today + overdue tasks (past `due_date`, not completed). Grouped by:
Overdue, today morning, today afternoon, today evening (when `has_time` is set).

**Upcoming:** Calendar-style view. Shows next 30 days. Each day shows tasks due on that day. Tasks
without `due_date` are excluded. Toggle between "list" and "calendar grid" view.

---

## 2. Projects & Sub-projects

- Hierarchical tree (parent_id self-reference), max 3 levels deep
- Each project: name, color, icon (emoji), description, view_style (list/board)
- Collapsible in sidebar; drag & drop to reorder and nest/unnest
- Archive (soft delete, tasks remain); special "Inbox" project cannot be deleted or archived

---

## 3. Sections within Projects

- Sections divide a project into groups (e.g. "To Do", "In Progress", "Done")
- Tasks belong to a section; sections reorderable via drag & drop
- Sections can be collapsed; tasks can be dragged between sections

---

## 4. Tasks & Subtasks

- Title (required), description (plain text or markdown)
- Priority P1–P4, due date (date-only or date+time), labels (multiple)
- Project + section assignment, subtasks via `parent_id` (unlimited nesting)
- Estimated duration, completion with animation, sort order within section

---

## 5. Priorities (P1–P4)

| Priority | Label  | Color   |
| -------- | ------ | ------- |
| P1       | Urgent | #EC1E2A |
| P2       | High   | #F59E0B |
| P3       | Medium | #3B82F6 |
| P4       | Low    | #6B7280 |

Default priority for new tasks: P4.

---

## 6. Labels/Tags

- User-defined with name + color; a task can have multiple labels
- Displayed as colored pills on task items
- Filterable; listed in sidebar; favorite labels appear at top

---

## 7. Natural Language Date Parsing

Parse strings such as:

- Spanish: "hoy", "mañana", "pasado mañana", "ayer", "lunes", "en 3 días", "en 2 semanas",
  "15 de marzo", "15/03", "todos los lunes", "cada 2 semanas"
- English: "today", "tomorrow", "next monday", "in 3 days", "15-03-2026"

Implementation: client-side parser first (`src/services/dateParser.ts`), Edge Function
(`supabase/functions/parse-date/`) as fallback for complex cases.

---

## 8. Recurring Tasks

Use RRULE format (RFC 5545) in `recurrence_rule`. Examples:

- Daily: `RRULE:FREQ=DAILY;INTERVAL=1`
- Weekly Monday: `RRULE:FREQ=WEEKLY;BYDAY=MO`
- Monthly 15th: `RRULE:FREQ=MONTHLY;BYMONTHDAY=15`
- Every 2 weeks: `RRULE:FREQ=WEEKLY;INTERVAL=2`

Two `recurrence_from` modes:

- **due_date** — next occurrence from original due date
- **completion_date** — next occurrence from when the task was completed

On completion of a recurring task, automatically create the next occurrence (handled by
`supabase/functions/generate-recurring/`).

---

## 9. Reminders

- Independent of due dates; multiple reminders per task
- Types: push notification, email; set to a specific datetime
- Quick options: "At time of due date", "10 min before", "1 hour before", "1 day before"
- Edge Function cron job (`process-reminders`) handles delivery

---

## 10. Comments & Attachments

**Comments:** Rich text via Tiptap (bold, italic, links, bullet lists, code); threaded per task;
timestamp + edit/delete.

**Attachments:** Upload to Supabase Storage; attach to task or comment; image preview; 25 MB limit;
accepted types: images, PDFs, documents, spreadsheets.

---

## 11. Favorites

- Projects, labels, and filters can be marked as favorite
- Favorites appear in a dedicated top section of the sidebar
- Toggle with star icon

---

## 12. Custom Filters & Filter Query Language

Saved filters with a mini query language:

```
# Priority
priority:1           → P1 tasks
priority:1,2         → P1 or P2

# Due date
due:today / due:tomorrow / due:overdue / due:nodate
due:next7days / due:before:2026-03-01

# Labels & projects
label:trabajo
label:personal,casa  → OR
project:MiProyecto

# Status
completed:false (default) / completed:true

# Text search
search:comprar

# Combinators: & (AND)  | (OR)  ! (NOT)
priority:1 & due:today
label:trabajo & !completed:true
(priority:1 | priority:2) & due:next7days
```

---

## 13. Quick Add

Triggered by `Q` or `Ctrl+K`. Input with NLP token parsing:

- `p1`–`p4` → priority
- `#labelname` → label
- `/projectname` → project
- Date expressions → due_date
- Everything else → title

Example: "Comprar leche mañana p1 #compras" → title "Comprar leche", due tomorrow, P1, label compras.

---

## 14. Drag & Drop (@dnd-kit)

- Reorder tasks within a section/project
- Move tasks between sections and between projects (sidebar drop)
- Reorder projects + sections; nest/unnest projects; nest/unnest subtasks

---

## 15. Themes & Visual Customization

- Light, Dark, System (auto); CSS variables for all colors; smooth transitions
- User preference persisted in `profiles.theme`

---

## 16. Real-time Sync

- Supabase Realtime subscriptions on tasks, projects, sections, labels
- Optimistic updates (update UI immediately, sync in background)
- Conflict resolution: last-write-wins
- Online/offline indicator; offline queue via IndexedDB, replayed on reconnect

---

## 17. Search

- Full-text search across task titles and descriptions; fuzzy matching
- Results grouped by project; keyboard shortcut `Ctrl+K` or `/`
- Recent searches saved locally

---

## 18. Keyboard Shortcuts

| Shortcut       | Action                   |
| -------------- | ------------------------ |
| `Q`            | Quick add task           |
| `Ctrl+K` / `/` | Search                   |
| `Ctrl+Z`       | Undo last action         |
| `1`–`4`        | Set priority (in editor) |
| `E`            | Edit selected task       |
| `Delete`       | Delete selected task     |
| `Space`        | Complete/uncomplete task |
| `↑` / `↓`      | Navigate tasks           |
| `→`            | Open task detail         |
| `←`            | Close task detail        |
| `G then I`     | Go to Inbox              |
| `G then T`     | Go to Today              |
| `G then U`     | Go to Upcoming           |
