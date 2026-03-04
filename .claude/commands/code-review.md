Review all uncommitted code changes for quality, security, and maintainability.

## Process

1. **Gather changes** — Run `git diff --staged` and `git diff` to see all modifications
2. **Identify scope** — List changed files and understand relationships
3. **Review each file** — Read full context including imports and surrounding code

## Review Checklist

### CRITICAL — Security

- Hardcoded credentials, API keys, tokens, Supabase keys
- SQL injection via string concatenation
- XSS from unescaped user input (dangerouslySetInnerHTML)
- Missing RLS policies on new Supabase tables
- Sensitive data in console.log or error messages

### HIGH — Code Quality

- Functions >50 lines
- Files >800 lines
- Deep nesting >4 levels
- Missing error handling on async operations
- Missing loading/error/empty states on data-fetching components
- Unused imports or dead code
- `any` types in TypeScript
- Missing useCallback/useMemo dependency arrays

### MEDIUM — React Patterns

- Prop drilling >3 levels (use Zustand or context)
- Missing React.memo on list item components
- State updates during render
- Missing keys in lists or using array index as key
- Stale closures in event handlers

### LOW — Best Practices

- console.log debugging statements left in code
- TODO without context
- Spanish UI text missing (all user-facing text must be in Spanish)
- date-fns not used for date operations

## Output Format

Report issues organized by severity:

```
## Code Review: [N files changed]

### 🔴 CRITICAL
- **file.tsx:42** — Description of issue → Suggested fix

### 🟡 HIGH
- **file.tsx:15** — Description → Fix

### 🔵 MEDIUM
- **file.tsx:88** — Description → Fix

### Verdict: ✅ Approve / ⚠️ Warning / 🚫 Block
```

Only report issues you are >80% confident are real problems.
