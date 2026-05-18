---
paths:
  - supabase/**
---

# Database Rules

Full schema reference: `docs/database-schema.md`

## Non-negotiable conventions

- **Every table MUST have RLS enabled** — no exceptions. Four policies per table: select, insert, update, delete. All use `user_id = auth.uid()`.
- **Primary keys:** always UUID with `gen_random_uuid()`.
- **Timestamps:** always `TIMESTAMPTZ`, never `TIMESTAMP`. Every table gets `created_at` and `updated_at`.
- **User references:** always `ON DELETE CASCADE` on `user_id` foreign keys.
- **Migration naming:** sequential, zero-padded — `001_`, `002_`, etc. One concern per file.
- Supabase Storage buckets and policies must be created in migrations, never ad-hoc.
- Validate auth token at the start of every Edge Function.
- Edge Functions are written in Deno/TypeScript.
