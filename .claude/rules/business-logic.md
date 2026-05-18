---
paths:
  - src/services/**
  - src/hooks/**
  - src/stores/**
---

# Business Logic Rules

## Services (`src/services/`)

- Service functions should be pure when possible (no side effects, predictable output).
- Filter parser (`filterService.ts`) returns a Supabase query builder — not raw SQL.
- NLP date parser (`dateParser.ts`): client-side first, no API calls for common Spanish/English patterns.
- RRULE handling: use the `rrule` npm package for RFC 5545 compliance — do not hand-roll recurrence math.

## Hooks (`src/hooks/`)

- Custom hooks own all data fetching and business logic — components stay presentational.
- TanStack Query: use `queryKey` factories for consistency; never inline string arrays.
- Optimistic updates: update the cache immediately, rollback on error. Never wait for server confirmation to update UI.
- Always support keyboard navigation for core task operations.

## Stores (`src/stores/`)

- Zustand stores: minimal state only. Computed/derived values belong in selectors, not stored state.
- Server state lives in TanStack Query, not Zustand. Zustand is for UI state (sidebar open, selected task, modal visibility, etc.).
- Form state: React Hook Form. URL state: React Router search params.
