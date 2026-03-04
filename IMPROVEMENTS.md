# Pendy — Mejoras Pendientes

Análisis completo del codebase. Última revisión: 2026-03-04.

---

## HIGH IMPACT

| #   | Área             | Problema                              | Detalle                                                                                                                                                                                               |
| --- | ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Feature faltante | **Custom Filters / Saved Filters**    | Feature completamente ausente. La tabla `filters` existe en DB y en `types.ts` pero no hay `filterService.ts`, `FilterEditor`, `FilterView`, ni rutas. Spec Phase 3.                                  |
| 2   | Feature faltante | **Realtime Sync**                     | No hay suscripciones de Supabase Realtime. No existe `useRealtimeSync`. Sin sync entre dispositivos — datos stale hasta refresh manual.                                                               |
| 3   | Feature faltante | **Offline Support / IndexedDB**       | No hay cola offline con IndexedDB, ni indicador online/offline, ni replay de mutaciones al reconectar. Spec Phase 4.                                                                                  |
| 4   | Seguridad        | **XSS via `dangerouslySetInnerHTML`** | `task.title` se renderiza como HTML sin sanitizar en `TaskItem.tsx:125`, `TaskDetail.tsx:1389`, `HabitItem.tsx:87`, `HabitsView.tsx:366`. Instalar `dompurify` y wrappear con `DOMPurify.sanitize()`. |
| 5   | Performance      | **`reorderTasks` N+1**                | `taskService.ts:346` — reordenar N tareas dispara N `UPDATE` individuales. Debería ser una sola llamada RPC con `CASE WHEN`. Mismo patrón en `reorderProjects`.                                       |
| 6   | Performance      | **`getInboxTasks` 2 queries**         | `taskService.ts:78` — hace 2 round trips secuenciales (buscar inbox project, luego buscar tasks). Podría ser 1 query con join o recibir `inboxProjectId` directo.                                     |
| 7   | Performance      | **`getTasksByLabel` 2 queries**       | `taskService.ts:307` — busca `task_ids` en `task_labels`, luego busca tasks con `.in()`. Reemplazar con join: `tasks.select('*, task_labels!inner()')`.                                               |
| 8   | UX               | **Sin estado de error en vistas**     | `TodayView.tsx:119`, `InboxView.tsx:127`, `UpcomingView.tsx` — solo manejan `isLoading`, no `isError`. Si Supabase falla, se muestra lista vacía sin indicación.                                      |
| 9   | UX               | **Sin Error Boundary**                | `main.tsx` no tiene Error Boundary. Un error de runtime crashea toda la app con pantalla blanca sin recuperación.                                                                                     |
| 10  | Performance      | **`cancelQueries` demasiado amplio**  | `useTasks.ts:116` — `cancelQueries({ queryKey: taskKeys.all })` cancela TODOS los queries de tareas en cada update. Debería cancelar solo los queries afectados.                                      |

---

## MEDIUM IMPACT

| #   | Área             | Problema                              | Detalle                                                                                                                                                                                                         |
| --- | ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | UX               | **Sin toast en errores de mutación**  | Sonner configurado en `main.tsx` pero solo usado en CalendarView. Las mutaciones de tasks fallan silenciosamente — el optimistic update revierte sin feedback. Agregar `onError` con toast en `useTasks.ts`.    |
| 12  | UX               | **Menú hover de TaskItem incompleto** | `TaskItem.tsx:196` — el menú de 3 puntos solo tiene "Eliminar". El context menu (click derecho) tiene todo (prioridad, fecha, mover, duplicar). En mobile no hay click derecho.                                 |
| 13  | UX               | **Settings page casi vacía**          | `SettingsPage.tsx` — solo muestra tema, calendario y push. Faltan: timezone, formato fecha/hora, inicio de semana, vista default, proyecto default quick-add, idioma. Todas las columnas existen en `profiles`. |
| 14  | Dead code        | **DashboardPage con mock data**       | `DashboardPage.tsx:17` — datos hardcodeados (`today: 8, overdue: 3`). No tiene ruta activa en `App.tsx`. Conectar con datos reales o eliminar.                                                                  |
| 15  | Performance      | **Arrow functions anulan React.memo** | `TodayView.tsx:218`, `InboxView.tsx:198` — `onToggleSelect={() => toggle(task.id)}` crea función nueva en cada render, anulando el `React.memo` de `TaskItem`.                                                  |
| 16  | Performance      | **Sin virtualización**                | `TaskList.tsx`, `UpcomingView.tsx` — listas largas (50+ tareas, 30 días) renderizan todo al DOM. Spec menciona "virtualized lists" pero no hay `@tanstack/react-virtual`.                                       |
| 17  | Accesibilidad    | **Faltan ARIA labels**                | Solo 6 `aria-*` en todo `src/`. Faltan en: botones del sidebar, drag handles, context menu (sin `role="menu"`), task rows (sin `role="button"`), header mobile button.                                          |
| 18  | Feature faltante | **Keyboard shortcuts incorrectos**    | Spec dice `G+I` → Inbox, `G+T` → Today, `G+U` → Upcoming. Implementado como teclas sueltas (`I`, `H`, `P`). Faltan: `Ctrl+Z`, `Space` (completar), `E` (editar), `↑↓` (navegar), `→←` (abrir/cerrar detail).    |
| 19  | Feature faltante | **Activity Log / Undo**               | `activity_log` definido en types y DB pero no hay `activityService.ts`, ni hook, ni `Ctrl+Z`. Spec Phase 3.                                                                                                     |
| 20  | Feature faltante | **Edge Functions faltantes**          | `parse-date/` y `generate-recurring/` no existen en `supabase/functions/`. Solo `process-reminders/` y `calendar-oauth/` están implementados.                                                                   |
| 21  | Data layer       | **`useAuth` fuera de TanStack Query** | `useAuth.ts` usa `useState` propio para profile. No está en cache de TanStack Query — no se puede invalidar con otras queries, y cada instancia del hook hace su propio fetch.                                  |
| 22  | Data layer       | **Sin `staleTime` en queries core**   | `useTasks.ts` — queries de inbox, today, project no tienen `staleTime` explícito. Completar tarea en vista de proyecto no actualiza inmediatamente la vista Today.                                              |

---

## LOW IMPACT

| #   | Área             | Problema                                | Detalle                                                                                                                                                                                         |
| --- | ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | UX               | **Search limitado**                     | `taskService.ts:297` — busca solo en títulos con `ilike`. Spec pide full-text en títulos + descripciones. Debería usar `to_tsvector`/`plainto_tsquery` de PostgreSQL.                           |
| 24  | UX               | **Overlay sidebar en iOS**              | `AppLayout.tsx:131` — overlay `onClick` puede no disparar en iOS Safari. Usar `onPointerUp` o agregar `cursor: pointer`. También: header + MobileNav comprimen el contenido en 375px.           |
| 25  | UX               | **TodayView sin botón "Agregar tarea"** | A diferencia de InboxView y ProjectView, TodayView no tiene botón visible para agregar tarea. Solo se puede via quick-add (`Q`).                                                                |
| 26  | UX               | **`groupBy: 'project'` no funciona**    | `viewUtils.ts:143` — la opción "Agrupar por proyecto" aparece en ViewOptionsBar pero `groupTasks()` no la implementa, devuelve todo sin agrupar.                                                |
| 27  | UX               | **Sin edición de perfil**               | `SettingsPage.tsx:59` — nombre y email son solo lectura. No hay form para editar `full_name`, `avatar_url`, ni "Cambiar contraseña" (aunque `resetPassword` existe en `useAuth`).               |
| 28  | Testing          | **Cero tests**                          | No hay archivos `*.test.ts` en `src/`. Vitest configurado (`vitest.config.ts`, `src/test/setup.ts`) pero nunca usado. `dateParser.ts` y `viewUtils.ts` tienen lógica compleja sin tests.        |
| 29  | Code quality     | **`useAuth` memory leak**               | `useAuth.ts:33` — `getSession()` promise sin cleanup. Si el componente se desmonta antes de resolver, `setAuthState` se llama en componente desmontado.                                         |
| 30  | Code quality     | **50+ inline hover handlers**           | En Sidebar, TaskContextMenu, ProjectView, etc. — hover effects con `onMouseEnter`/`onMouseLeave` que mutan `style` directamente. No funciona con keyboard focus. Debería ser Tailwind `hover:`. |
| 31  | Feature faltante | **Sin onboarding**                      | Usuarios nuevos caen directo en Today sin guía. Spec Phase 5 pide welcome screen / tutorial de features.                                                                                        |
| 32  | Feature faltante | **Sin import/export**                   | No hay exportación CSV/JSON de datos. Spec Phase 5.                                                                                                                                             |

---

## Bundle Size

| Chunk             | Tamaño       | gzip   |
| ----------------- | ------------ | ------ |
| `index.js` (main) | **1,439 KB** | 442 KB |
| `schemas.js`      | 84 KB        | 25 KB  |
| `CalendarView.js` | 41 KB        | 11 KB  |
| `TodayPage.js`    | 34 KB        | 10 KB  |

Vite recomienda code-splitting con `dynamic import()` o `manualChunks` para el bundle principal.
