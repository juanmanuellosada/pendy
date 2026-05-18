---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# Testing Rules

## Conventions

- Test file naming: `*.test.ts` for logic, `*.test.tsx` for components.
- Test directory mirrors `src/` structure (e.g. `src/services/dateParser.ts` → `src/services/dateParser.test.ts`).
- Use `describe` + `it` pattern — no top-level bare `test()` calls.
- Mock all Supabase calls in service tests; do not hit the real database.

## Coverage priorities (minimum)

- All services (`src/services/`)
- NLP date parser — cover Spanish and English inputs, including edge cases
- Filter query parser — cover all operators and combinators
- Recurrence logic — cover all RRULE patterns
- Core components (TaskItem, TaskEditor, TaskCheckbox)

## Tools

- Unit + service tests: Vitest
- Component tests: Testing Library (`@testing-library/react`)
- Run all tests: `pnpm test:run`
