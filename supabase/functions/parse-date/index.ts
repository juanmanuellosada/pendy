import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Natural language date parser for Spanish and English.
 * Used as fallback for complex expressions the client-side parser can't handle.
 *
 * POST /parse-date
 * Body: { text: string, timezone?: string }
 * Returns: { date: string | null, has_time: boolean, time?: string, recurrence_rule?: string }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { text, timezone = 'America/Argentina/Buenos_Aires' } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = parseNaturalDate(text.trim().toLowerCase(), timezone)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

interface ParseResult {
  date: string | null
  has_time: boolean
  time?: string
  recurrence_rule?: string
}

function parseNaturalDate(text: string, _timezone: string): ParseResult {
  const now = new Date()
  const today = formatDate(now)

  // Spanish patterns
  if (text === 'hoy') return { date: today, has_time: false }
  if (text === 'mañana') return { date: addDays(now, 1), has_time: false }
  if (text === 'pasado mañana') return { date: addDays(now, 2), has_time: false }

  // English patterns
  if (text === 'today') return { date: today, has_time: false }
  if (text === 'tomorrow') return { date: addDays(now, 1), has_time: false }

  // "en X días/semanas/meses"
  const enMatch = text.match(/^en\s+(\d+)\s+(d[ií]as?|semanas?|meses?)$/)
  if (enMatch) {
    const n = parseInt(enMatch[1])
    const unit = enMatch[2]
    if (unit.startsWith('d')) return { date: addDays(now, n), has_time: false }
    if (unit.startsWith('s')) return { date: addDays(now, n * 7), has_time: false }
    if (unit.startsWith('m')) {
      const d = new Date(now)
      d.setMonth(d.getMonth() + n)
      return { date: formatDate(d), has_time: false }
    }
  }

  // "in X days/weeks/months"
  const inMatch = text.match(/^in\s+(\d+)\s+(days?|weeks?|months?)$/)
  if (inMatch) {
    const n = parseInt(inMatch[1])
    const unit = inMatch[2]
    if (unit.startsWith('d')) return { date: addDays(now, n), has_time: false }
    if (unit.startsWith('w')) return { date: addDays(now, n * 7), has_time: false }
    if (unit.startsWith('m')) {
      const d = new Date(now)
      d.setMonth(d.getMonth() + n)
      return { date: formatDate(d), has_time: false }
    }
  }

  // Day names (Spanish)
  const dayNamesEs: Record<string, number> = {
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
  if (dayNamesEs[text] !== undefined) {
    return { date: nextDayOfWeek(now, dayNamesEs[text]), has_time: false }
  }

  // Day names (English)
  const dayNamesEn: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }
  const nextMatch = text.match(/^next\s+(\w+)$/)
  if (nextMatch && dayNamesEn[nextMatch[1]!] !== undefined) {
    return { date: nextDayOfWeek(now, dayNamesEn[nextMatch[1]!]), has_time: false }
  }

  // Recurrence patterns
  if (text.match(/^todos los lunes$/)) {
    return {
      date: nextDayOfWeek(now, 1),
      has_time: false,
      recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
    }
  }
  if (text.match(/^cada (\d+) semanas?$/)) {
    const interval = parseInt(text.match(/(\d+)/)![1])
    return {
      date: addDays(now, 7),
      has_time: false,
      recurrence_rule: `RRULE:FREQ=WEEKLY;INTERVAL=${interval}`,
    }
  }
  if (text.match(/^cada mes$/)) {
    return {
      date: addDays(now, 30),
      has_time: false,
      recurrence_rule: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${now.getDate()}`,
    }
  }

  // DD/MM or DD/MM/YYYY
  const ddmm = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
  if (ddmm) {
    const day = parseInt(ddmm[1])
    const month = parseInt(ddmm[2]) - 1
    const year = ddmm[3]
      ? ddmm[3].length === 2
        ? 2000 + parseInt(ddmm[3])
        : parseInt(ddmm[3])
      : now.getFullYear()
    const d = new Date(year, month, day)
    if (!isNaN(d.getTime())) return { date: formatDate(d), has_time: false }
  }

  return { date: null, has_time: false }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): string {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return formatDate(result)
}

function nextDayOfWeek(from: Date, dayOfWeek: number): string {
  const current = from.getDay()
  let diff = dayOfWeek - current
  if (diff <= 0) diff += 7
  return addDays(from, diff)
}
