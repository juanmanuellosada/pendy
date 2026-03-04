import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseNLPTokens } from './dateParser'
import { format, addDays, nextDay } from 'date-fns'

// Fix "today" for deterministic tests
const FIXED_NOW = new Date(2026, 2, 4, 10, 0, 0) // 2026-03-04 Wed
const TODAY = format(FIXED_NOW, 'yyyy-MM-dd')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

describe('parseNLPTokens', () => {
  // ── Relative dates ───────────────────────────────────────────────────────
  describe('relative dates', () => {
    it('parses "hoy"', () => {
      expect(parseNLPTokens('hoy').date).toBe(TODAY)
    })

    it('parses "mañana"', () => {
      expect(parseNLPTokens('mañana').date).toBe(format(addDays(FIXED_NOW, 1), 'yyyy-MM-dd'))
    })

    it('parses "pasado mañana"', () => {
      expect(parseNLPTokens('pasado mañana').date).toBe(format(addDays(FIXED_NOW, 2), 'yyyy-MM-dd'))
    })

    it('parses "ayer"', () => {
      expect(parseNLPTokens('ayer').date).toBe(format(addDays(FIXED_NOW, -1), 'yyyy-MM-dd'))
    })
  })

  // ── Relative offsets ─────────────────────────────────────────────────────
  describe('relative offsets', () => {
    it('parses "en 3 días"', () => {
      expect(parseNLPTokens('en 3 días').date).toBe(format(addDays(FIXED_NOW, 3), 'yyyy-MM-dd'))
    })

    it('parses "en 2 semanas"', () => {
      expect(parseNLPTokens('en 2 semanas').date).toBe(format(addDays(FIXED_NOW, 14), 'yyyy-MM-dd'))
    })

    it('parses "en 1 mes"', () => {
      const expected = new Date(FIXED_NOW)
      expected.setMonth(expected.getMonth() + 1)
      expect(parseNLPTokens('en 1 mes').date).toBe(format(expected, 'yyyy-MM-dd'))
    })
  })

  // ── Day names ────────────────────────────────────────────────────────────
  describe('day names', () => {
    it('parses "lunes"', () => {
      const next = nextDay(FIXED_NOW, 1)
      expect(parseNLPTokens('lunes').date).toBe(format(next, 'yyyy-MM-dd'))
    })

    it('parses "viernes"', () => {
      const next = nextDay(FIXED_NOW, 5)
      expect(parseNLPTokens('viernes').date).toBe(format(next, 'yyyy-MM-dd'))
    })

    it('parses "próximo lunes"', () => {
      const next = nextDay(FIXED_NOW, 1)
      expect(parseNLPTokens('próximo lunes').date).toBe(format(next, 'yyyy-MM-dd'))
    })
  })

  // ── Explicit dates ───────────────────────────────────────────────────────
  describe('explicit dates', () => {
    it('parses "15 de marzo"', () => {
      expect(parseNLPTokens('15 de marzo').date).toBe('2026-03-15')
    })

    it('parses "1 de enero de 2027"', () => {
      expect(parseNLPTokens('1 de enero de 2027').date).toBe('2027-01-01')
    })

    it('parses "15/03"', () => {
      expect(parseNLPTokens('15/03').date).toBe('2026-03-15')
    })

    it('parses "15/03/2026"', () => {
      expect(parseNLPTokens('15/03/2026').date).toBe('2026-03-15')
    })
  })

  // ── Time ─────────────────────────────────────────────────────────────────
  describe('time', () => {
    it('parses "a las 14:00"', () => {
      const r = parseNLPTokens('a las 14:00')
      expect(r.time).toBe('14:00')
      expect(r.hasTime).toBe(true)
    })

    it('parses "3pm"', () => {
      const r = parseNLPTokens('3pm')
      expect(r.time).toBe('15:00')
      expect(r.hasTime).toBe(true)
    })

    it('parses "9am"', () => {
      const r = parseNLPTokens('9am')
      expect(r.time).toBe('09:00')
      expect(r.hasTime).toBe(true)
    })

    it('parses "a las 9"', () => {
      const r = parseNLPTokens('a las 9')
      expect(r.time).toBe('09:00')
      expect(r.hasTime).toBe(true)
    })
  })

  // ── Duration ─────────────────────────────────────────────────────────────
  describe('duration', () => {
    it('parses "1h30m"', () => {
      expect(parseNLPTokens('1h30m').durationMinutes).toBe(90)
    })

    it('parses "2h"', () => {
      expect(parseNLPTokens('2h').durationMinutes).toBe(120)
    })

    it('parses "30min"', () => {
      expect(parseNLPTokens('30min').durationMinutes).toBe(30)
    })

    it('parses "por 45m"', () => {
      expect(parseNLPTokens('por 45m').durationMinutes).toBe(45)
    })
  })

  // ── Recurrence ───────────────────────────────────────────────────────────
  describe('recurrence', () => {
    it('parses "cada día"', () => {
      const r = parseNLPTokens('cada día')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=DAILY;INTERVAL=1')
    })

    it('parses "cada semana"', () => {
      const r = parseNLPTokens('cada semana')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1')
    })

    it('parses "cada lunes"', () => {
      const r = parseNLPTokens('cada lunes')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO')
    })

    it('parses "cada 2 semanas"', () => {
      const r = parseNLPTokens('cada 2 semanas')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2')
    })

    it('parses "cada día laborable"', () => {
      const r = parseNLPTokens('cada día laborable')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    })
  })

  // ── Combined expressions ─────────────────────────────────────────────────
  describe('combined', () => {
    it('parses "mañana a las 14:00 por 1h"', () => {
      const r = parseNLPTokens('mañana a las 14:00 por 1h')
      expect(r.date).toBe(format(addDays(FIXED_NOW, 1), 'yyyy-MM-dd'))
      expect(r.time).toBe('14:00')
      expect(r.hasTime).toBe(true)
      expect(r.durationMinutes).toBe(60)
    })

    it('parses "cada lunes a las 9am"', () => {
      const r = parseNLPTokens('cada lunes a las 9am')
      expect(r.isRecurring).toBe(true)
      expect(r.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO')
      expect(r.time).toBe('09:00')
    })
  })

  // ── No match ─────────────────────────────────────────────────────────────
  it('returns null date for unrecognized text', () => {
    const r = parseNLPTokens('comprar leche')
    expect(r.date).toBeNull()
    expect(r.hasTime).toBe(false)
  })
})
