---
paths:
  - src/components/**
  - src/pages/**
---

# UI Component Rules

Brand colors and typography: `docs/brand.md`

## Rules

- All components in TypeScript with proper types; no implicit `any`.
- Use `cn()` utility for conditional class merging.
- Mobile-first responsive: design for 375px, then scale up (`sm:` `md:` `lg:` `xl:`).
- Every interactive element must have explicit hover, focus, and active states.
- Use Lucide React for all icons — no other icon libraries.
- Use `date-fns` with `es` locale for all date formatting — never raw `Date` operations.
- Animations: use Tailwind's `transition-*` classes or CSS `@keyframes`; no third-party animation libs.
- Checkbox completion animation: scale + fade to green + strikethrough text.
- Sidebar is collapsible on mobile (slide from left).
- Task detail displays as a right panel on desktop, full page on mobile.
- Always handle loading, error, and empty states for every data-fetching component.
- Use `React.memo()` for list item components; `useCallback`/`useMemo` where perf matters.
- Props interfaces named `{ComponentName}Props`; destructure in function signature.
- All user-facing text in Spanish (UI labels, placeholders, messages).
