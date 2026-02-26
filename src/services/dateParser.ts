import { format, addDays, nextDay, getDay } from 'date-fns'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const DAY_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  'miércoles': 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  'sábado': 6,
  sabado: 6,
}

const DAY_NAMES_PATTERN = 'domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado'

export interface NLPResult {
  date: string | null
  time: string | null
  hasTime: boolean
  durationMinutes: number | null
  isRecurring: boolean
  recurrenceRule: string | null
  patterns: RegExp[]
}

export function parseNLPTokens(text: string): NLPResult {
  const result: NLPResult = {
    date: null,
    time: null,
    hasTime: false,
    durationMinutes: null,
    isRecurring: false,
    recurrenceRule: null,
    patterns: [],
  }

  const today = new Date()
  // Working copy for sequential matching — consumed tokens are removed
  // so later patterns don't re-match parts already claimed.
  let working = text.toLowerCase()

  // ── 1. Recurrence ──────────────────────────────────────────────────────────

  // "cada día laborable"
  if (/\bcada d[ií]a laborable\b/.test(working)) {
    result.isRecurring = true
    result.recurrenceRule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    result.patterns.push(/\bcada d[ií]a laborable\b/i)
    working = working.replace(/\bcada d[ií]a laborable\b/, ' ')
  }

  // "cada N días/semanas/meses/años"
  if (!result.isRecurring) {
    const m = working.match(/\bcada (\d+)\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/)
    if (m) {
      const interval = parseInt(m[1]!)
      const unit = m[2]!
      let freq = 'DAILY'
      if (/semana/.test(unit)) freq = 'WEEKLY'
      else if (/mes/.test(unit)) freq = 'MONTHLY'
      else if (/a[ñn]o/.test(unit)) freq = 'YEARLY'
      result.isRecurring = true
      result.recurrenceRule = `RRULE:FREQ=${freq};INTERVAL=${interval}`
      result.patterns.push(/\bcada \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/i)
      working = working.replace(/\bcada \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/, ' ')
    }
  }

  // "cada lunes/martes/…"
  if (!result.isRecurring) {
    const re = new RegExp(`\\bcada (${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      const normalized = m[1]!.replace('é', 'e').replace('á', 'a')
      const dayNum = DAY_MAP[normalized] ?? DAY_MAP[m[1]!]
      if (dayNum !== undefined) {
        result.isRecurring = true
        result.recurrenceRule = `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[dayNum]}`
        result.patterns.push(new RegExp(`\\bcada (?:${DAY_NAMES_PATTERN})\\b`, 'i'))
        working = working.replace(re, ' ')
      }
    }
  }

  // "cada día" / "cada semana" / "cada mes" / "cada año"
  if (!result.isRecurring) {
    const m = working.match(/\bcada (d[ií]a|semana|mes|a[ñn]o)\b/)
    if (m) {
      const unit = m[1]!
      let freq = 'DAILY'
      if (/semana/.test(unit)) freq = 'WEEKLY'
      else if (/^mes$/.test(unit)) freq = 'MONTHLY'
      else if (/a[ñn]o/.test(unit)) freq = 'YEARLY'
      result.isRecurring = true
      result.recurrenceRule = `RRULE:FREQ=${freq};INTERVAL=1`
      result.patterns.push(/\bcada (?:d[ií]a|semana|mes|a[ñn]o)\b/i)
      working = working.replace(/\bcada (?:d[ií]a|semana|mes|a[ñn]o)\b/, ' ')
    }
  }

  // ── 2. Duration ────────────────────────────────────────────────────────────
  // Matches: "por 1h30m", "por 2h", "por 30min", "1h30m", "2h", "30min", "45m", "15 min"

  // "por 1h30m" / "1h30m" (compound)
  {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*h\s*(\d+)\s*m(?:in(?:utos?)?)?\b/)
    if (m) {
      result.durationMinutes = parseInt(m[1]!) * 60 + parseInt(m[2]!)
      result.patterns.push(/\b(?:por\s+)?\d+\s*h\s*\d+\s*m(?:in(?:utos?)?)?\b/i)
      working = working.replace(/\b(?:por\s+)?\d+\s*h\s*\d+\s*m(?:in(?:utos?)?)?\b/, ' ')
    }
  }

  // "por 2h" / "2h" / "2hs" / "1 hora" / "2 horas"
  if (result.durationMinutes === null) {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*(?:hs?|horas?)\b/)
    if (m) {
      result.durationMinutes = parseInt(m[1]!) * 60
      result.patterns.push(/\b(?:por\s+)?\d+\s*(?:hs?|horas?)\b/i)
      working = working.replace(/\b(?:por\s+)?\d+\s*(?:hs?|horas?)\b/, ' ')
    }
  }

  // "por 30min" / "30min" / "30m" / "15 min" / "45 minutos"
  if (result.durationMinutes === null) {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*(?:min(?:utos?)?|m)\b/)
    if (m) {
      result.durationMinutes = parseInt(m[1]!)
      result.patterns.push(/\b(?:por\s+)?\d+\s*(?:min(?:utos?)?|m)\b/i)
      working = working.replace(/\b(?:por\s+)?\d+\s*(?:min(?:utos?)?|m)\b/, ' ')
    }
  }

  // ── 3. Time ────────────────────────────────────────────────────────────────
  // Matches: "a las 14:00", "14:00", "9am", "3pm", "a las 9", "a las 3pm"

  // "a las HH:MM" / standalone "HH:MM"
  {
    const m = working.match(/\b(?:a las\s+)?(\d{1,2}):(\d{2})\b/)
    if (m) {
      const h = parseInt(m[1]!)
      const mn = parseInt(m[2]!)
      if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
        result.time = `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
        result.hasTime = true
        result.patterns.push(/\b(?:a las\s+)?\d{1,2}:\d{2}\b/i)
        working = working.replace(/\b(?:a las\s+)?\d{1,2}:\d{2}\b/, ' ')
      }
    }
  }

  // "a las 3pm" / "9am" / "3pm" (with optional "a las")
  if (!result.hasTime) {
    const m = working.match(/\b(?:a las\s+)?(\d{1,2})\s*(am|pm)\b/)
    if (m) {
      let h = parseInt(m[1]!)
      if (m[2] === 'pm' && h < 12) h += 12
      if (m[2] === 'am' && h === 12) h = 0
      if (h >= 0 && h <= 23) {
        result.time = `${String(h).padStart(2, '0')}:00`
        result.hasTime = true
        result.patterns.push(/\b(?:a las\s+)?\d{1,2}\s*(?:am|pm)\b/i)
        working = working.replace(/\b(?:a las\s+)?\d{1,2}\s*(?:am|pm)\b/, ' ')
      }
    }
  }

  // "a las N" (full hour, only with "a las" prefix to avoid false positives)
  if (!result.hasTime) {
    const m = working.match(/\ba las (\d{1,2})\b/)
    if (m) {
      const h = parseInt(m[1]!)
      if (h >= 0 && h <= 23) {
        result.time = `${String(h).padStart(2, '0')}:00`
        result.hasTime = true
        result.patterns.push(/\ba las \d{1,2}\b/i)
        working = working.replace(/\ba las \d{1,2}\b/, ' ')
      }
    }
  }

  // ── 4. Date ────────────────────────────────────────────────────────────────

  // "pasado mañana"
  if (/\bpasado ma[ñn]ana\b/.test(working)) {
    result.date = format(addDays(today, 2), 'yyyy-MM-dd')
    result.patterns.push(/\bpasado ma[ñn]ana\b/i)
    working = working.replace(/\bpasado ma[ñn]ana\b/, ' ')
  }

  // "mañana" — only when NOT preceded by "la " or "esta " (those mean "morning")
  if (!result.date) {
    // Protect "por la mañana", "de la mañana", "esta mañana", etc.
    if (/(?<!(?:la|esta) )\bma[ñn]ana\b/.test(working)) {
      result.date = format(addDays(today, 1), 'yyyy-MM-dd')
      result.patterns.push(/(?<!(?:la|esta) )\bma[ñn]ana\b/i)
      working = working.replace(/(?<!(?:la|esta) )\bma[ñn]ana\b/, ' ')
    }
  }

  // "hoy"
  if (!result.date && /\bhoy\b/.test(working)) {
    result.date = format(today, 'yyyy-MM-dd')
    result.patterns.push(/\bhoy\b/i)
    working = working.replace(/\bhoy\b/, ' ')
  }

  // "este fin de semana"
  if (!result.date && /\beste fin de semana\b/.test(working)) {
    // Next Saturday
    const dayOfWeek = getDay(today)
    const daysToSat = dayOfWeek <= 6 ? (6 - dayOfWeek) || 7 : 7
    result.date = format(addDays(today, daysToSat), 'yyyy-MM-dd')
    result.patterns.push(/\beste fin de semana\b/i)
    working = working.replace(/\beste fin de semana\b/, ' ')
  }

  // "próxima semana"
  if (!result.date && /\bpr[oó]xima semana\b/.test(working)) {
    const dayOfWeek = getDay(today)
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    result.date = format(addDays(today, daysUntilMonday), 'yyyy-MM-dd')
    result.patterns.push(/\bpr[oó]xima semana\b/i)
    working = working.replace(/\bpr[oó]xima semana\b/, ' ')
  }

  // "próximo/a {day name}"
  if (!result.date) {
    const re = new RegExp(`\\bpr[oó]xim[oa]\\s+(${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      const normalized = m[1]!.replace('é', 'e').replace('á', 'a')
      const targetDay = DAY_MAP[normalized] ?? DAY_MAP[m[1]!]
      if (targetDay !== undefined) {
        const next = nextDay(today, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6)
        result.date = format(next, 'yyyy-MM-dd')
        result.patterns.push(new RegExp(`\\bpr[oó]xim[oa]\\s+(?:${DAY_NAMES_PATTERN})\\b`, 'i'))
        working = working.replace(re, ' ')
      }
    }
  }

  // "en N días/semanas/meses/años"
  if (!result.date) {
    const m = working.match(/\ben (\d+)\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/)
    if (m) {
      const n = parseInt(m[1]!)
      const unit = m[2]!
      let target: Date
      if (/d[ií]a/.test(unit)) {
        target = addDays(today, n)
      } else if (/semana/.test(unit)) {
        target = addDays(today, n * 7)
      } else if (/mes/.test(unit)) {
        target = new Date(today)
        target.setMonth(target.getMonth() + n)
      } else {
        target = new Date(today)
        target.setFullYear(target.getFullYear() + n)
      }
      result.date = format(target, 'yyyy-MM-dd')
      result.patterns.push(/\ben \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/i)
      working = working.replace(/\ben \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/, ' ')
    }
  }

  // Standalone day name — last resort (e.g. "reunión lunes")
  if (!result.date) {
    const re = new RegExp(`\\b(${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      const normalized = m[1]!.replace('é', 'e').replace('á', 'a')
      const targetDay = DAY_MAP[normalized] ?? DAY_MAP[m[1]!]
      if (targetDay !== undefined) {
        const currentDay = getDay(today)
        if (targetDay !== currentDay) {
          const next = nextDay(today, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6)
          result.date = format(next, 'yyyy-MM-dd')
          result.patterns.push(new RegExp(`\\b(?:${DAY_NAMES_PATTERN})\\b`, 'i'))
        }
      }
    }
  }

  return result
}

/**
 * Strip matched NLP tokens from an HTML string by walking text nodes.
 */
export function stripNLPTokens(html: string, patterns: RegExp[]): string {
  if (patterns.length === 0) return html
  const div = document.createElement('div')
  div.innerHTML = html
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    nodes.push(node)
  }
  for (const textNode of nodes) {
    let text = textNode.textContent ?? ''
    for (const pattern of patterns) {
      text = text.replace(pattern, '')
    }
    // Collapse multiple spaces, trim edges
    text = text.replace(/\s{2,}/g, ' ')
    textNode.textContent = text
  }
  return div.innerHTML
}
