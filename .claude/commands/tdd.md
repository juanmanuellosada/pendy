Implement the requested feature or fix using strict Test-Driven Development.

Follow the RED → GREEN → REFACTOR cycle:

## Step 1: Define Interfaces

- Define TypeScript types/interfaces for inputs and outputs
- Identify the public API of the module/component

## Step 2: Write Failing Tests (RED)

- Write comprehensive tests BEFORE any implementation
- Cover: happy path, edge cases, error cases
- Use Vitest + Testing Library (for components)
- Test file naming: `*.test.ts` or `*.test.tsx` colocated with source
- Run tests to confirm they FAIL for the right reason

## Step 3: Implement Minimal Code (GREEN)

- Write ONLY enough code to make tests pass
- No extra features, no premature optimization
- Run tests after each change to verify progress

## Step 4: Refactor

- Improve code quality while keeping tests GREEN
- Extract helpers, improve naming, reduce duplication
- Run tests after each refactor step

## Step 5: Verify Coverage

- Run `pnpm test:run` with coverage
- Target: 80% minimum, 100% for critical business logic
- Critical paths for Pendy: date parsing, filter engine, recurrence, task CRUD

## Testing Patterns for Pendy

### Service tests (dateParser, filterService, recurrenceService)

```typescript
describe('functionName', () => {
  it('should handle normal case', () => { ... })
  it('should handle edge case', () => { ... })
  it('should throw on invalid input', () => { ... })
})
```

### Component tests (TaskItem, TaskQuickAdd, etc.)

```typescript
describe('ComponentName', () => {
  it('renders correctly with props', () => { ... })
  it('handles user interaction', async () => { ... })
  it('shows loading/error/empty states', () => { ... })
})
```

### Hook tests (useTasks, useProjects, etc.)

```typescript
// Use renderHook from @testing-library/react
```

## Rules

- NEVER write implementation before tests
- NEVER skip running tests between steps
- NEVER test implementation details — test behavior
- ALWAYS use semantic selectors (getByRole, getByLabelText)
- Mock Supabase client in service tests
