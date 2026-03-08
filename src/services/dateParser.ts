import { format, addDays, nextDay, getDay } from 'date-fns'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const DAY_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
}

const DAY_NAMES_PATTERN = 'domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado'

// ── Meses para fechas explícitas ──────────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  sep: 9,
  sept: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
}

const MONTH_NAMES_PATTERN =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|jun|jul|ago|sept?|oct|nov|dic'

export interface NLPResult {
  date: string | null
  time: string | null
  hasTime: boolean
  durationMinutes: number | null
  isRecurring: boolean
  recurrenceRule: string | null
  patterns: RegExp[]
}

export function parseNLPTokens(text: string, disabledPhrases?: Set<string>): NLPResult {
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

  // Helper: check if a matched phrase is disabled
  const disabled = (matchedText: string): boolean =>
    disabledPhrases?.has(matchedText.trim().toLowerCase()) ?? false

  // ── 1. Recurrence ──────────────────────────────────────────────────────────

  // "cada día laborable"
  {
    const m = working.match(/\bcada d[ií]a laborable\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.isRecurring = true
        result.recurrenceRule = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
        result.patterns.push(/\bcada d[ií]a laborable\b/i)
      }
      working = working.replace(/\bcada d[ií]a laborable\b/, ' ')
    }
  }

  // "cada N días/semanas/meses/años"
  if (!result.isRecurring) {
    const m = working.match(/\bcada (\d+)\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/)
    if (m) {
      if (!disabled(m[0])) {
        const interval = parseInt(m[1]!)
        const unit = m[2]!
        let freq = 'DAILY'
        if (/semana/.test(unit)) freq = 'WEEKLY'
        else if (/mes/.test(unit)) freq = 'MONTHLY'
        else if (/a[ñn]o/.test(unit)) freq = 'YEARLY'
        result.isRecurring = true
        result.recurrenceRule = `RRULE:FREQ=${freq};INTERVAL=${interval}`
        result.patterns.push(/\bcada \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/i)
      }
      working = working.replace(/\bcada \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/, ' ')
    }
  }

  // "cada lunes/martes/…"
  if (!result.isRecurring) {
    const re = new RegExp(`\\bcada (${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      if (!disabled(m[0])) {
        const normalized = m[1]!.replace('é', 'e').replace('á', 'a')
        const dayNum = DAY_MAP[normalized] ?? DAY_MAP[m[1]!]
        if (dayNum !== undefined) {
          result.isRecurring = true
          result.recurrenceRule = `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[dayNum]}`
          result.patterns.push(new RegExp(`\\bcada (?:${DAY_NAMES_PATTERN})\\b`, 'i'))
        }
      }
      working = working.replace(re, ' ')
    }
  }

  // "cada día" / "cada semana" / "cada mes" / "cada año"
  if (!result.isRecurring) {
    const m = working.match(/\bcada (d[ií]a|semana|mes|a[ñn]o)\b/)
    if (m) {
      if (!disabled(m[0])) {
        const unit = m[1]!
        let freq = 'DAILY'
        if (/semana/.test(unit)) freq = 'WEEKLY'
        else if (/^mes$/.test(unit)) freq = 'MONTHLY'
        else if (/a[ñn]o/.test(unit)) freq = 'YEARLY'
        result.isRecurring = true
        result.recurrenceRule = `RRULE:FREQ=${freq};INTERVAL=1`
        result.patterns.push(/\bcada (?:d[ií]a|semana|mes|a[ñn]o)\b/i)
      }
      working = working.replace(/\bcada (?:d[ií]a|semana|mes|a[ñn]o)\b/, ' ')
    }
  }

  // ── 2. Duration ────────────────────────────────────────────────────────────
  // Matches: "por 1h30m", "por 2h", "por 30min", "1h30m", "2h", "30min", "45m", "15 min"

  // "por 1h30m" / "1h30m" (compound)
  {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*h\s*(\d+)\s*m(?:in(?:utos?)?)?\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.durationMinutes = parseInt(m[1]!) * 60 + parseInt(m[2]!)
        result.patterns.push(/\b(?:por\s+)?\d+\s*h\s*\d+\s*m(?:in(?:utos?)?)?\b/i)
      }
      working = working.replace(/\b(?:por\s+)?\d+\s*h\s*\d+\s*m(?:in(?:utos?)?)?\b/, ' ')
    }
  }

  // "por 2h" / "2h" / "2hs" / "1 hora" / "2 horas"
  if (result.durationMinutes === null) {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*(?:hs?|horas?)\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.durationMinutes = parseInt(m[1]!) * 60
        result.patterns.push(/\b(?:por\s+)?\d+\s*(?:hs?|horas?)\b/i)
      }
      working = working.replace(/\b(?:por\s+)?\d+\s*(?:hs?|horas?)\b/, ' ')
    }
  }

  // "por 30min" / "30min" / "30m" / "15 min" / "45 minutos"
  if (result.durationMinutes === null) {
    const m = working.match(/\b(?:por\s+)?(\d+)\s*(?:min(?:utos?)?|m)\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.durationMinutes = parseInt(m[1]!)
        result.patterns.push(/\b(?:por\s+)?\d+\s*(?:min(?:utos?)?|m)\b/i)
      }
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
        if (!disabled(m[0])) {
          result.time = `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
          result.hasTime = true
          result.patterns.push(/\b(?:a las\s+)?\d{1,2}:\d{2}\b/i)
        }
        working = working.replace(/\b(?:a las\s+)?\d{1,2}:\d{2}\b/, ' ')
      }
    }
  }

  // "a las 3pm" / "9am" / "3pm" (with optional "a las")
  if (!result.hasTime) {
    const m = working.match(/\b(?:a las\s+)?(\d{1,2})\s*(am|pm)\b/)
    if (m) {
      if (!disabled(m[0])) {
        let h = parseInt(m[1]!)
        if (m[2] === 'pm' && h < 12) h += 12
        if (m[2] === 'am' && h === 12) h = 0
        if (h >= 0 && h <= 23) {
          result.time = `${String(h).padStart(2, '0')}:00`
          result.hasTime = true
          result.patterns.push(/\b(?:a las\s+)?\d{1,2}\s*(?:am|pm)\b/i)
        }
      }
      working = working.replace(/\b(?:a las\s+)?\d{1,2}\s*(?:am|pm)\b/, ' ')
    }
  }

  // "a las N" (full hour, only with "a las" prefix to avoid false positives)
  if (!result.hasTime) {
    const m = working.match(/\ba las (\d{1,2})\b/)
    if (m) {
      if (!disabled(m[0])) {
        const h = parseInt(m[1]!)
        if (h >= 0 && h <= 23) {
          result.time = `${String(h).padStart(2, '0')}:00`
          result.hasTime = true
          result.patterns.push(/\ba las \d{1,2}\b/i)
        }
      }
      working = working.replace(/\ba las \d{1,2}\b/, ' ')
    }
  }

  // ── 4. Date ────────────────────────────────────────────────────────────────

  // "pasado mañana"
  {
    const m = working.match(/\bpasado ma[ñn]ana\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.date = format(addDays(today, 2), 'yyyy-MM-dd')
        result.patterns.push(/\bpasado ma[ñn]ana\b/i)
      }
      working = working.replace(/\bpasado ma[ñn]ana\b/, ' ')
    }
  }

  // "mañana" — only when NOT preceded by "la " or "esta " (those mean "morning")
  if (!result.date) {
    const m = working.match(/(?<!(?:la|esta) )\bma[ñn]ana\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.date = format(addDays(today, 1), 'yyyy-MM-dd')
        result.patterns.push(/(?<!(?:la|esta) )\bma[ñn]ana\b/i)
      }
      working = working.replace(/(?<!(?:la|esta) )\bma[ñn]ana\b/, ' ')
    }
  }

  // "ayer"
  if (!result.date) {
    const m = working.match(/\bayer\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.date = format(addDays(today, -1), 'yyyy-MM-dd')
        result.patterns.push(/\bayer\b/i)
      }
      working = working.replace(/\bayer\b/, ' ')
    }
  }

  // "hoy"
  if (!result.date) {
    const m = working.match(/\bhoy\b/)
    if (m) {
      if (!disabled(m[0])) {
        result.date = format(today, 'yyyy-MM-dd')
        result.patterns.push(/\bhoy\b/i)
      }
      working = working.replace(/\bhoy\b/, ' ')
    }
  }

  // "este fin de semana"
  if (!result.date) {
    const m = working.match(/\beste fin de semana\b/)
    if (m) {
      if (!disabled(m[0])) {
        // Next Saturday
        const dayOfWeek = getDay(today)
        const daysToSat = dayOfWeek <= 6 ? 6 - dayOfWeek || 7 : 7
        result.date = format(addDays(today, daysToSat), 'yyyy-MM-dd')
        result.patterns.push(/\beste fin de semana\b/i)
      }
      working = working.replace(/\beste fin de semana\b/, ' ')
    }
  }

  // "próxima semana"
  if (!result.date) {
    const m = working.match(/\bpr[oó]xima semana\b/)
    if (m) {
      if (!disabled(m[0])) {
        const dayOfWeek = getDay(today)
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
        result.date = format(addDays(today, daysUntilMonday), 'yyyy-MM-dd')
        result.patterns.push(/\bpr[oó]xima semana\b/i)
      }
      working = working.replace(/\bpr[oó]xima semana\b/, ' ')
    }
  }

  // "próximo/a {day name}"
  if (!result.date) {
    const re = new RegExp(`\\bpr[oó]xim[oa]\\s+(${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      if (!disabled(m[0])) {
        const normalized = m[1]!.replace('é', 'e').replace('á', 'a')
        const targetDay = DAY_MAP[normalized] ?? DAY_MAP[m[1]!]
        if (targetDay !== undefined) {
          const next = nextDay(today, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6)
          result.date = format(next, 'yyyy-MM-dd')
          result.patterns.push(new RegExp(`\\bpr[oó]xim[oa]\\s+(?:${DAY_NAMES_PATTERN})\\b`, 'i'))
        }
      }
      working = working.replace(re, ' ')
    }
  }

  // "en N días/semanas/meses/años"
  if (!result.date) {
    const m = working.match(/\ben (\d+)\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/)
    if (m) {
      if (!disabled(m[0])) {
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
      }
      working = working.replace(/\ben \d+\s+(?:d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)\b/, ' ')
    }
  }

  // ── 5. Explicit date formats ────────────────────────────────────────────────

  // "15 de marzo" / "15 de marzo de 2026" / "15 de mar"
  if (!result.date) {
    const re = new RegExp(
      `\\b(\\d{1,2})\\s+de\\s+(${MONTH_NAMES_PATTERN})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`,
      'i',
    )
    const m = working.match(re)
    if (m) {
      if (!disabled(m[0])) {
        const day = parseInt(m[1]!)
        const monthKey = m[2]!
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const month = MONTH_MAP[monthKey] ?? MONTH_MAP[m[2]!.toLowerCase()]
        const year = m[3] ? parseInt(m[3]) : today.getFullYear()
        if (month && day >= 1 && day <= 31) {
          result.date = format(new Date(year, month - 1, day), 'yyyy-MM-dd')
          result.patterns.push(
            new RegExp(
              `\\b\\d{1,2}\\s+de\\s+(?:${MONTH_NAMES_PATTERN})(?:\\s+(?:de\\s+)?\\d{4})?\\b`,
              'i',
            ),
          )
        }
      }
      working = working.replace(re, ' ')
    }
  }

  // "15/03" / "15/03/2026" / "15-03" / "15-03-2026" / "15-03-26"
  if (!result.date) {
    const m = working.match(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/)
    if (m) {
      if (!disabled(m[0])) {
        const day = parseInt(m[1]!)
        const month = parseInt(m[2]!)
        let year = today.getFullYear()
        if (m[3]) {
          const y = parseInt(m[3])
          year = y < 100 ? 2000 + y : y
        }
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          result.date = format(new Date(year, month - 1, day), 'yyyy-MM-dd')
          result.patterns.push(/\b\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?\b/)
        }
      }
      working = working.replace(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/, ' ')
    }
  }

  // Standalone day name — last resort (e.g. "reunión lunes")
  if (!result.date) {
    const re = new RegExp(`\\b(${DAY_NAMES_PATTERN})\\b`)
    const m = working.match(re)
    if (m) {
      if (!disabled(m[0])) {
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
