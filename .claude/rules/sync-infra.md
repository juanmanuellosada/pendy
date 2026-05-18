---
paths:
  - src-tauri/**
  - supabase/functions/**
  - capacitor/**
---

# Sync & Infrastructure Rules

## Realtime (Supabase)

- Subscribe to user-specific channels only — never broadcast or global channels.
- Subscriptions live in `src/hooks/useRealtimeSync.ts`.

## Offline Support

- Use IndexedDB (via `idb-keyval`) to queue mutations when offline.
- Replay the queue on reconnect; do not drop or silently discard queued operations.
- Expose an online/offline indicator to the user via `src/components/common/OfflineBanner.tsx`.

## Auth

- Always redirect to the login page if the Supabase session has expired.
- Never store credentials in code or `localStorage` — use Supabase Auth exclusively.
- Credentials must come from environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Edge Functions (Deno/TypeScript in `supabase/functions/`)

- Validate the auth token (`Authorization: Bearer <jwt>`) at the start of every function.
- Functions: `parse-date`, `process-reminders`, `generate-recurring`, `calendar-oauth`.

## Desktop (Tauri v2 — `src-tauri/`)

- Use Tauri commands for native features (notifications, system tray).
- See `memory/tauri-linux-gotchas.md` for known Linux build traps (NO_STRIP, ACL workaround, etc.).
- Capabilities are defined in `src-tauri/capabilities/`; do not bypass ACL with `shell:execute-all` etc.

## Mobile (Capacitor — `capacitor/`)

- Push notifications: use the Capacitor Push Notifications plugin.
- Install prompt: handled by `src/hooks/useInstallPrompt.ts`.
