# Setup Claude Code para Pendy

Copia y pega este prompt en Claude Code cuando clones el repo en una PC nueva:

---

## Prompt de setup

```
Necesito que configures este proyecto de Pendy para trabajar con Claude Code. Hacé lo siguiente:

1. **Instalar dependencias**: Ejecutá `pnpm install`

2. **Configurar MCP**: Copiá `.mcp.json.example` a `.mcp.json` y preguntame por el Supabase PAT token para reemplazar YOUR_SUPABASE_PAT_HERE

3. **Verificar settings**: Confirmá que `.claude/settings.json` existe con los hooks de Prettier (ya viene del repo)

4. **Verificar commands**: Confirmá que estos slash commands existen en `.claude/commands/`:
   - verify.md — Verificación completa del codebase
   - code-review.md — Review de cambios uncommitted
   - tdd.md — Workflow TDD

5. **Probar que todo funciona**: Ejecutá `pnpm build` para verificar que compila

Cuando termines, mostrá un resumen de lo que quedó configurado.
```

---

## Qué incluye el repo

### Slash Co| Comando | Descripción |

| -------------- | -------------------------------------------------------------------------- |
| `/verify` | Build + types + lint + tests + code audit. Soporta args: `quick`, `pre-pr` |
| `/code-review` | Review de cambios por severidad: CRITICAL → HIGH → MEDIUM |
| `/tdd` | Workflow TDD: RED → GREEN → REFACTOR con 80% coverage |

### Hooks (`/.claude/settings.json`)

| Hook                 | Trigger              | Acción                                   |
| -------------------- | -------------------- | ---------------------------------------- |
| Prettier auto-format | Después de cada Edit | Formatea el archivo editado con Prettier |

### MCPs (`/.mcp.json.example`)

| MCP              | Descripción                                               |
| ---------------- | --------------------------------------------------------- |
| `supabase-pendy` | Acceso directo a la DB de Supabase (requiere PAT)         |
| `context7`       | Documentación live de React, Supabase, Tailwind, date-fns |

### Archivos que NO se commitean (gitignored)

| Archivo                       | Razón                                    |
| ----------------------------- | ---------------------------------------- |
| `.mcp.json`                   | Contiene el Supabase PAT token (secreto) |
| `.claude/settings.local.json` | Permisos locales de cada PC              |
| `.env.local`                  | Variables de entorno con credenciales    |

| `.env.local` | Variables de entorno con credenciales |

---

## Obtener el Supabase PAT

1. Ir a https://supabase.com/dashboard/account/tokens
2. Crear un nuevo token con acceso al proyecto `pendy` (ref: `ynytwbspmqgqwgquxnhf`)
3. Pegarlo en `.mcp.json` donde dice `YOUR_SUPABASE_PAT_HERE`
