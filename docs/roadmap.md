# Pendy — Implementation Roadmap

## Phase 1 — MVP Foundation (Week 1–2)

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

---

## Phase 2 — Power Features (Week 3–4)

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

---

## Phase 3 — Premium Features (Week 5–6)

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

---

## Phase 4 — Multi-platform (Week 7–8)

**Goal:** Ship on all platforms.

1. Capacitor setup + mobile build (iOS + Android)
2. Mobile-specific UI adjustments
3. Push notifications (Capacitor plugin)
4. Tauri setup + desktop build
5. System tray integration (desktop)
6. Auto-update (Tauri updater)
7. Offline support (IndexedDB + sync queue)
8. Real-time sync (Supabase Realtime)

---

## Phase 5 — Polish & Optimization (Week 9–10)

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
