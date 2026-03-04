Run a comprehensive verification of the codebase. Execute these checks sequentially, stopping on critical failures:

## 1. Build Check

Run `pnpm build` and report any errors.
If build fails, STOP and report the errors — do not continue.

## 2. Type Check

Run `npx tsc --noEmit` to find TypeScript errors.
Report each error with file:line and description.

## 3. Lint Check

Run `pnpm lint` if available, or `npx eslint src/ --ext .ts,.tsx`.
Report warnings and errors.

## 4. Test Execution

Run `pnpm test:run` to execute the test suite.
Report pass/fail counts and coverage if available.

## 5. Code Audit

Search for:

- `console.log` statements in src/ (excluding test files)
- TODO/FIXME comments without context
- Any hardcoded URLs or credentials

## Output Format

```
## Verification Report

| Check       | Status | Details          |
|-------------|--------|------------------|
| Build       | ✅/❌   | ...              |
| Types       | ✅/❌   | N errors         |
| Lint        | ✅/❌   | N warnings       |
| Tests       | ✅/❌   | N/M passed       |
| Code Audit  | ✅/⚠️   | ...              |

**Verdict:** Ready for PR / Needs fixes
```

If the argument is "quick", only run Build + Types.
If the argument is "pre-pr", run all checks plus a security scan for exposed secrets.
