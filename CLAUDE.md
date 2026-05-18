# Pendy — Claude Instructions

@AGENTS.md

Pendy is a personal task manager (web + Tauri desktop + Capacitor mobile) built on React + Supabase.
For stack, commands, project structure, and coding conventions, see `AGENTS.md`.

---

## Important Rules

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

---

## Scoped rules (auto-loaded by path)

| Scope                                                   | File                              |
| ------------------------------------------------------- | --------------------------------- |
| `supabase/**`                                           | `.claude/rules/database.md`       |
| `src/components/**`, `src/pages/**`                     | `.claude/rules/ui-components.md`  |
| `src/services/**`, `src/hooks/**`, `src/stores/**`      | `.claude/rules/business-logic.md` |
| `src-tauri/**`, `supabase/functions/**`, `capacitor/**` | `.claude/rules/sync-infra.md`     |
| `**/*.test.ts`, `**/*.test.tsx`                         | `.claude/rules/testing.md`        |

---

## Reference docs (load on demand, not every session)

- `docs/brand.md` — colors, logo, typography
- `docs/database-schema.md` — full SQL schema, indexes, RLS, functions
- `docs/features.md` — all 18 feature specifications
- `docs/roadmap.md` — implementation phases 1–5
