import { supabase } from '@/lib/supabase'
import type { Filter, Task, Label, Project } from '@/lib/types'

// ─── Token types ─────────────────────────────────────────────────────────────

type TokenType =
  | 'FIELD'
  | 'COLON'
  | 'VALUE'
  | 'COMMA'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  pos: number
}

// ─── AST nodes ───────────────────────────────────────────────────────────────

interface FieldNode {
  type: 'field'
  field: string
  operator: string | null // e.g. 'before' for due:before:2026-01-01
  values: string[]
}

interface AndNode {
  type: 'and'
  left: ASTNode
  right: ASTNode
}

interface OrNode {
  type: 'or'
  left: ASTNode
  right: ASTNode
}

interface NotNode {
  type: 'not'
  operand: ASTNode
}

type ASTNode = FieldNode | AndNode | OrNode | NotNode

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(query: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < query.length) {
    // Skip whitespace
    if (/\s/.test(query[i]!)) {
      i++
      continue
    }

    const ch = query[i]!

    if (ch === '&') {
      tokens.push({ type: 'AND', value: '&', pos: i })
      i++
    } else if (ch === '|') {
      tokens.push({ type: 'OR', value: '|', pos: i })
      i++
    } else if (ch === '!') {
      tokens.push({ type: 'NOT', value: '!', pos: i })
      i++
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i })
      i++
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i })
      i++
    } else if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':', pos: i })
      i++
    } else if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i })
      i++
    } else {
      // Read a word (field name or value)
      const start = i
      while (i < query.length && !/[\s&|!():,]/.test(query[i]!)) {
        i++
      }
      const word = query.slice(start, i)

      // Determine if this is a field name or a value based on context
      const lastToken = tokens[tokens.length - 1]
      if (lastToken?.type === 'COLON' || lastToken?.type === 'COMMA') {
        tokens.push({ type: 'VALUE', value: word, pos: start })
      } else {
        tokens.push({ type: 'FIELD', value: word, pos: start })
      }
    }
  }

  tokens.push({ type: 'EOF', value: '', pos: i })
  return tokens
}

// ─── Parser (recursive descent) ──────────────────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
    this.pos = 0
  }

  private peek(): Token {
    return this.tokens[this.pos]!
  }

  private advance(): Token {
    const token = this.tokens[this.pos]!
    this.pos++
    return token
  }

  private expect(type: TokenType): Token {
    const token = this.peek()
    if (token.type !== type) {
      throw new Error(`Se esperaba ${type} pero se encontró ${token.type} en posición ${token.pos}`)
    }
    return this.advance()
  }

  parse(): ASTNode {
    const node = this.parseOr()
    if (this.peek().type !== 'EOF') {
      throw new Error(`Token inesperado «${this.peek().value}» en posición ${this.peek().pos}`)
    }
    return node
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd()
    while (this.peek().type === 'OR') {
      this.advance()
      const right = this.parseAnd()
      left = { type: 'or', left, right }
    }
    return left
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot()
    while (this.peek().type === 'AND') {
      this.advance()
      const right = this.parseNot()
      left = { type: 'and', left, right }
    }
    return left
  }

  private parseNot(): ASTNode {
    if (this.peek().type === 'NOT') {
      this.advance()
      const operand = this.parseNot()
      return { type: 'not', operand }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): ASTNode {
    if (this.peek().type === 'LPAREN') {
      this.advance()
      const node = this.parseOr()
      this.expect('RPAREN')
      return node
    }

    // Must be a field expression: field:value or field:operator:value
    const fieldToken = this.expect('FIELD')
    this.expect('COLON')

    const firstValue = this.expect('VALUE')

    // Check for operator syntax: field:operator:value (e.g. due:before:2026-01-01)
    if (this.peek().type === 'COLON') {
      this.advance()
      const secondValue = this.expect('VALUE')
      // Collect comma-separated values
      const values = [secondValue.value]
      while (this.peek().type === 'COMMA') {
        this.advance()
        values.push(this.expect('VALUE').value)
      }
      return {
        type: 'field',
        field: fieldToken.value.toLowerCase(),
        operator: firstValue.value.toLowerCase(),
        values,
      }
    }

    // Collect comma-separated values
    const values = [firstValue.value]
    while (this.peek().type === 'COMMA') {
      this.advance()
      values.push(this.expect('VALUE').value)
    }

    return {
      type: 'field',
      field: fieldToken.value.toLowerCase(),
      operator: null,
      values,
    }
  }
}

// ─── Executor ────────────────────────────────────────────────────────────────

export interface FilterContext {
  labels: Label[]
  projects: Project[]
  taskLabelsMap: Map<string, Label[]>
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]!
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

function evaluateField(node: FieldNode, task: Task, ctx: FilterContext): boolean {
  const { field, operator, values } = node

  switch (field) {
    case 'priority': {
      return values.includes(String(task.priority))
    }

    case 'due': {
      if (operator === 'before') {
        return task.due_date != null && task.due_date < values[0]!
      }
      if (operator === 'after') {
        return task.due_date != null && task.due_date > values[0]!
      }

      const today = getToday()
      return values.some((v) => {
        switch (v.toLowerCase()) {
          case 'today':
            return task.due_date === today
          case 'tomorrow':
            return task.due_date === addDays(today, 1)
          case 'overdue':
            return task.due_date != null && task.due_date < today && !task.is_completed
          case 'nodate':
            return task.due_date == null
          case 'next7days': {
            if (!task.due_date) return false
            const end = addDays(today, 7)
            return task.due_date >= today && task.due_date <= end
          }
          case 'next30days': {
            if (!task.due_date) return false
            const end30 = addDays(today, 30)
            return task.due_date >= today && task.due_date <= end30
          }
          default:
            // Treat as a specific date
            return task.due_date === v
        }
      })
    }

    case 'label': {
      const taskLabels = ctx.taskLabelsMap.get(task.id) ?? []
      return values.some((v) => {
        const lower = v.toLowerCase()
        return taskLabels.some((l) => l.name.toLowerCase() === lower)
      })
    }

    case 'project': {
      return values.some((v) => {
        const lower = v.toLowerCase()
        const project = ctx.projects.find((p) => p.id === task.project_id)
        return project?.name.toLowerCase() === lower
      })
    }

    case 'completed': {
      const val = values[0]?.toLowerCase()
      if (val === 'true') return task.is_completed
      if (val === 'false') return !task.is_completed
      return true
    }

    case 'search': {
      const term = values.join(',').toLowerCase()
      return (
        task.title.toLowerCase().includes(term) ||
        (task.description?.toLowerCase().includes(term) ?? false)
      )
    }

    case 'recurring': {
      const val = values[0]?.toLowerCase()
      if (val === 'true') return task.is_recurring
      if (val === 'false') return !task.is_recurring
      return true
    }

    case 'subtask': {
      const val = values[0]?.toLowerCase()
      if (val === 'true') return task.parent_id != null
      if (val === 'false') return task.parent_id == null
      return true
    }

    case 'created': {
      if (!task.created_at) return false
      const dateOnly = task.created_at.split('T')[0]!
      if (operator === 'before') return dateOnly < values[0]!
      if (operator === 'after') return dateOnly > values[0]!
      return dateOnly === values[0]!
    }

    case 'no_project': {
      const project = ctx.projects.find((p) => p.id === task.project_id)
      return project?.is_inbox === true
    }

    default:
      return true
  }
}

function createPredicate(node: ASTNode, ctx: FilterContext): (task: Task) => boolean {
  switch (node.type) {
    case 'field':
      return (task) => evaluateField(node, task, ctx)
    case 'and': {
      const leftFn = createPredicate(node.left, ctx)
      const rightFn = createPredicate(node.right, ctx)
      return (task) => leftFn(task) && rightFn(task)
    }
    case 'or': {
      const leftFn = createPredicate(node.left, ctx)
      const rightFn = createPredicate(node.right, ctx)
      return (task) => leftFn(task) || rightFn(task)
    }
    case 'not': {
      const fn = createPredicate(node.operand, ctx)
      return (task) => !fn(task)
    }
  }
}

/** Check if query explicitly mentions the completed field */
function hasCompletedField(node: ASTNode): boolean {
  switch (node.type) {
    case 'field':
      return node.field === 'completed'
    case 'and':
    case 'or':
      return hasCompletedField(node.left) || hasCompletedField(node.right)
    case 'not':
      return hasCompletedField(node.operand)
  }
}

// ─── Public query engine API ─────────────────────────────────────────────────

export const filterQueryEngine = {
  /** Parse a query string into an AST. Throws on syntax errors. */
  parse(query: string): ASTNode {
    const tokens = tokenize(query.trim())
    const parser = new Parser(tokens)
    return parser.parse()
  },

  /** Validate a query string. Returns null on success or an error message. */
  validate(query: string): string | null {
    if (!query.trim()) return 'La consulta no puede estar vacía'
    try {
      this.parse(query)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Error de sintaxis'
    }
  },

  /** Execute a parsed AST against a list of tasks. Auto-adds completed:false unless query has completed: */
  execute(ast: ASTNode, tasks: Task[], ctx: FilterContext): Task[] {
    let predicate = createPredicate(ast, ctx)

    // Auto-filter out completed tasks unless the query explicitly checks completed
    if (!hasCompletedField(ast)) {
      const basePredicate = predicate
      predicate = (task) => !task.is_completed && basePredicate(task)
    }

    return tasks.filter(predicate)
  },

  /** Parse + execute in one step */
  run(query: string, tasks: Task[], ctx: FilterContext): Task[] {
    const ast = this.parse(query)
    return this.execute(ast, tasks, ctx)
  },
}

// ─── Filter CRUD ─────────────────────────────────────────────────────────────

export const filterService = {
  async getFilters(userId: string): Promise<Filter[]> {
    const { data, error } = await supabase
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getFilter(id: string): Promise<Filter | null> {
    const { data, error } = await supabase.from('filters').select('*').eq('id', id).maybeSingle()

    if (error) throw error
    return data
  },

  async createFilter(filter: {
    user_id: string
    name: string
    query: string
    color?: string
    icon?: string | null
  }): Promise<Filter> {
    const { data: maxOrder } = await supabase
      .from('filters')
      .select('sort_order')
      .eq('user_id', filter.user_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('filters')
      .insert({ ...filter, sort_order: (maxOrder?.sort_order ?? -1) + 1 })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateFilter(
    id: string,
    updates: Partial<Pick<Filter, 'name' | 'query' | 'color' | 'icon' | 'is_favorite'>>,
  ): Promise<Filter> {
    const { data, error } = await supabase
      .from('filters')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteFilter(id: string): Promise<void> {
    const { error } = await supabase.from('filters').delete().eq('id', id)
    if (error) throw error
  },
}
