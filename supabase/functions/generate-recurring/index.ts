import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Generates the next occurrence of completed recurring tasks.
 * Called after a recurring task is completed.
 *
 * Can be invoked:
 * - Via cron (processes all pending recurring tasks)
 * - Via POST with { task_id: string } (processes a single task)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let taskIds: string[] = []

    if (req.method === 'POST') {
      // Verify auth for direct calls
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      )
      const {
        data: { user },
      } = await supabaseUser.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      if (body.task_id) {
        taskIds = [body.task_id]
      }
    }

    // If no specific task, find all completed recurring tasks that need next occurrence
    if (taskIds.length === 0) {
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('is_recurring', true)
        .eq('is_completed', true)
        .not('recurrence_rule', 'is', null)
      taskIds = (tasks ?? []).map((t: { id: string }) => t.id)
    }

    let generated = 0

    for (const taskId of taskIds) {
      const { data: task } = await supabaseAdmin.from('tasks').select('*').eq('id', taskId).single()

      if (!task || !task.is_recurring || !task.recurrence_rule || !task.is_completed) continue

      const nextDate = computeNextOccurrence(
        task.recurrence_rule,
        task.recurrence_from === 'completion_date' ? task.completed_at : task.due_date,
      )

      if (!nextDate) continue

      // Create the next occurrence
      const { error } = await supabaseAdmin.from('tasks').insert({
        user_id: task.user_id,
        project_id: task.project_id,
        section_id: task.section_id,
        parent_id: task.parent_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: nextDate,
        due_datetime:
          task.has_time && task.due_datetime
            ? new Date(
                `${nextDate}T${new Date(task.due_datetime).toISOString().slice(11)}`,
              ).toISOString()
            : null,
        has_time: task.has_time,
        duration_minutes: task.duration_minutes,
        is_completed: false,
        completed_at: null,
        is_recurring: true,
        recurrence_rule: task.recurrence_rule,
        recurrence_from: task.recurrence_from,
        sort_order: task.sort_order,
        depth: task.depth,
      })

      if (!error) generated++
    }

    return new Response(JSON.stringify({ success: true, generated, processed: taskIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Compute next occurrence from an RRULE string.
 * Simplified parser — handles DAILY, WEEKLY (with BYDAY), MONTHLY (with BYMONTHDAY).
 */
function computeNextOccurrence(rrule: string, fromDateStr: string | null): string | null {
  if (!fromDateStr) return null

  const fromDate = new Date(fromDateStr)
  if (isNaN(fromDate.getTime())) return null

  const parts = parseRRule(rrule)
  if (!parts) return null

  const { freq, interval, byDay, byMonthDay } = parts

  const result = new Date(fromDate)

  switch (freq) {
    case 'DAILY':
      result.setDate(result.getDate() + interval)
      break

    case 'WEEKLY':
      if (byDay && byDay.length > 0) {
        // Find next matching day of week
        const dayMap: Record<string, number> = {
          SU: 0,
          MO: 1,
          TU: 2,
          WE: 3,
          TH: 4,
          FR: 5,
          SA: 6,
        }
        const targetDays = byDay.map((d) => dayMap[d]).filter((d) => d !== undefined)
        if (targetDays.length > 0) {
          const currentDay = result.getDay()
          let minDiff = Infinity
          for (const target of targetDays) {
            let diff = target - currentDay
            if (diff <= 0) diff += 7 * interval
            if (diff < minDiff) minDiff = diff
          }
          result.setDate(result.getDate() + minDiff)
        } else {
          result.setDate(result.getDate() + 7 * interval)
        }
      } else {
        result.setDate(result.getDate() + 7 * interval)
      }
      break

    case 'MONTHLY':
      result.setMonth(result.getMonth() + interval)
      if (byMonthDay) {
        result.setDate(byMonthDay)
      }
      break

    case 'YEARLY':
      result.setFullYear(result.getFullYear() + interval)
      break

    default:
      return null
  }

  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`
}

function parseRRule(rrule: string): {
  freq: string
  interval: number
  byDay?: string[]
  byMonthDay?: number
} | null {
  const clean = rrule.replace('RRULE:', '')
  const pairs = clean.split(';')
  let freq = ''
  let interval = 1
  let byDay: string[] | undefined
  let byMonthDay: number | undefined

  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (!key || !value) continue
    switch (key) {
      case 'FREQ':
        freq = value
        break
      case 'INTERVAL':
        interval = parseInt(value) || 1
        break
      case 'BYDAY':
        byDay = value.split(',')
        break
      case 'BYMONTHDAY':
        byMonthDay = parseInt(value)
        break
    }
  }

  if (!freq) return null
  return { freq, interval, byDay, byMonthDay }
}
