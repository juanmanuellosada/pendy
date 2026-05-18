# Pendy — Agent Reference

Pendy is a personal task management app (no collaboration, no gamification) that runs on web,
desktop (Tauri v2), and mobile (Capacitor) from a single React codebase backed by Supabase.

**Key design principle:** Fast, offline-capable, beautifully designed, feature-rich.

---

## Tech Stack

### Frontend

- React 19 + Vite, TypeScript strict mode
- Tailwind CSS v4, shadcn/ui (customized to brand colors)
- Zustand (global/UI state) + TanStack Query v5 (server state)
- React Router v7, @dnd-kit (drag & drop), date-fns v4 with `es` locale
- React Hook Form + Zod, Tiptap v3 (rich text), Lucide React icons
- `rrule` for RFC 5545 recurrence

### Backend

- Supabase: PostgreSQL, Auth (email + Google OAuth), Realtime, Storage
- Edge Functions (Deno): `parse-date`, `process-reminders`, `generate-recurring`, `calendar-oauth`

### Multi-platform

- Desktop: Tauri v2 (`src-tauri/`)
- Mobile: Capacitor (`capacitor/` — not yet scaffolded)

### Development

- pnpm, ESLint + Prettier, Vitest + Testing Library, Husky + lint-staged

---

## Commands

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start Vite dev server                   |
| `pnpm build`        | Type-check + Vite production build      |
| `pnpm lint`         | Run ESLint                              |
| `pnpm format`       | Prettier write (src/\*_/_.{ts,tsx,css}) |
| `pnpm format:check` | Prettier check (CI)                     |
| `pnpm test`         | Vitest watch mode                       |
| `pnpm test:run`     | Vitest single run                       |
| `pnpm tauri:dev`    | Tauri dev (desktop)                     |
| `pnpm tauri:build`  | Tauri production build (desktop)        |

---

## Project Structure (accurate as of v0.1.0)

```
pendy/
├── AGENTS.md / CLAUDE.md
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── vite.config.ts / vitest.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── index.html
├── pendy-logo.png / pendy-logo-transparent.png
│
├── public/                     # Static assets + PWA
│   ├── manifest.json / sw.js
│   ├── icon-{72,96,128,144,152,167,180,192,512}.png
│   └── pendy-logo.png
│
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root with providers
│   ├── index.css               # Tailwind imports + CSS variables
│   ├── vite-env.d.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts / types.ts / constants.ts / utils.ts
│   │   ├── platform.ts / sound.ts / projectTree.ts / viewUtils.ts
│   │   ├── habitUtils.ts / queryPersister.ts / tiptapExtensions.ts
│   │
│   ├── hooks/
│   │   │   # useAuth, useTasks, useProjects, useSections, useLabels, useFilters,
│   │   │   # useComments, useReminders, useHabits, useActivityLog, useCalendarEvents,
│   │   │   # useCalendarIntegrations, usePushNotifications, useRealtimeSync,
│   │   │   # useNetworkStatus, useBulkSelection, useIsMobile, useInstallPrompt,
│   │   └── # useAppBadge, useFloatingPosition, useTheme
│   │
│   ├── stores/
│   │   ├── appStore.ts         # Sidebar, modals, selected task
│   │   └── uiStore.ts          # View state, quick-add open, bulk selection
│   │
│   ├── services/
│   │   │   # task, project, section, label, filter, comment, reminder, habit,
│   │   └── # activity, calendar, push services + dateParser.ts (NLP, ES + EN)
│   │
│   ├── components/
│   │   ├── ui/         # shadcn/ui base components
│   │   ├── layout/     # AppLayout, Sidebar, Header, MobileNav
│   │   ├── tasks/      # TaskList, VirtualTaskList, TaskItem, TaskDetail, TaskEditor, TaskCheckbox, etc.
│   │   ├── projects/   # ProjectView, ProjectEditor, SectionEditor
│   │   ├── views/      # InboxView, TodayView, UpcomingView, BoardView, CalendarView, HabitsView, etc.
│   │   ├── habits/     # HabitItem, HabitDetail, HabitEditor, HabitCheckbox
│   │   ├── filters/    # FilterEditor, FilterQueryInput
│   │   ├── comments/   # CommentList, CommentEditor
│   │   ├── settings/   # CalendarIntegrations, InstallOptions, PushNotifications
│   │   └── common/     # ColorPicker, DateTimePicker, ReminderPicker, ConfirmDialog, BulkActionBar, OfflineBanner, ErrorBoundary, etc.
│   │
│   ├── pages/
│   │   ├── LandingPage.tsx / NotFoundPage.tsx
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx / RegisterPage.tsx / ForgotPasswordPage.tsx
│   │   └── app/
│   │       ├── InboxPage.tsx / TodayPage.tsx / UpcomingPage.tsx
│   │       ├── ProjectPage.tsx / LabelPage.tsx / LabelsPage.tsx
│   │       ├── FilterPage.tsx / FiltersPage.tsx / SearchPage.tsx
│   │       ├── HabitsPage.tsx / CompletedPage.tsx / TaskPage.tsx
│   │       └── SettingsPage.tsx
│   │
│   ├── styles/
│   │   └── themes.ts           # Light/dark theme token definitions
│   │
│   └── test/                   # Test utilities / setup
│
├── supabase/
│   ├── config.toml
│   ├── migrations/             # 001–012 (sequential SQL files)
│   └── functions/
│       ├── parse-date/         # NLP date parsing (Deno)
│       ├── process-reminders/  # Reminder cron (Deno)
│       ├── generate-recurring/ # Recurring task generation (Deno)
│       └── calendar-oauth/     # Calendar OAuth flow (Deno)
│
├── src-tauri/                  # Tauri v2 desktop wrapper
│   ├── tauri.conf.json / Cargo.toml / Cargo.lock / build.rs
│   ├── Pendy.desktop
│   ├── src/                    # Rust entry + commands
│   ├── capabilities/           # Tauri ACL capability files
│   ├── icons/ / gen/
│
└── .claude/
    ├── settings.json / settings.local.json
    ├── commands/               # Custom slash commands
    ├── rules/                  # Scoped agent rules (see each file)
    └── skills/
```

---

## Coding Conventions

### Naming

- Variables/functions: `camelCase`; components/types: `PascalCase`
- File names: `kebab-case` (except component files which use `PascalCase.tsx`)
- Exports: named exports preferred; default export only for pages

### React

- Functional components only; no class components
- Custom hooks for all data fetching and business logic
- Props interfaces named `{ComponentName}Props`; destructure in function signature
- `React.memo()` on list item components; `useCallback`/`useMemo` where perf matters

### State

- Server state: TanStack Query — use `queryKey` factories for consistency
- Global/UI state: Zustand — minimal state, computed values as selectors
- Form state: React Hook Form
- URL state: React Router search params

### CSS / Tailwind

- Tailwind classes directly in JSX; `cn()` for conditional merging
- Extract patterns into components, not CSS utility classes
- CSS variables for theme colors defined in `src/index.css`
- Mobile-first breakpoints: `sm:` `md:` `lg:` `xl:`

### TypeScript

- Strict mode, no `any`, no type assertions unless absolutely necessary

### Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `test:`
- Branch naming: `feat/task-crud`, `fix/date-parser`, `refactor/sidebar`
- Commit messages in English

---

## Reference Docs

- Brand colors, logo, typography → `docs/brand.md`
- Full database schema (tables, indexes, RLS, functions) → `docs/database-schema.md`
- Feature specifications (all 18 features) → `docs/features.md`
- Implementation roadmap (phases 1–5) → `docs/roadmap.md`
