import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isYesterday, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a "YYYY-MM-DD" date string as LOCAL midnight (not UTC).
 * Fixes the timezone bug where parseISO / new Date("2026-02-25")
 * creates UTC midnight which shows as the previous day in UTC- timezones.
 */
export function parseLocalDate(date: string): Date {
  const parts = date.split('-').map(Number)
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!)
}

function toLocalDate(date: Date | string): Date {
  if (typeof date === 'string') {
    // Date-only string "YYYY-MM-DD" → local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return parseLocalDate(date)
    // Has time component → use Date constructor (handles ISO with offset)
    return new Date(date)
  }
  return date
}

export function formatDate(date: Date | string, formatStr = 'dd MMM'): string {
  return format(toLocalDate(date), formatStr, { locale: es })
}

export function formatRelativeDate(date: Date | string): string {
  const d = toLocalDate(date)
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  if (isYesterday(d)) return 'Ayer'
  return format(d, "d 'de' MMM", { locale: es })
}

export function isOverdue(date: Date | string): boolean {
  const d = toLocalDate(date)
  return isBefore(startOfDay(d), startOfDay(new Date()))
}

export function formatDateTime(date: Date | string): string {
  return format(toLocalDate(date), "d 'de' MMM, HH:mm", { locale: es })
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function stripHtmlTags(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '').trim()
}

export function stripLabelTokensFromText(text: string): string {
  if (!text) return ''
  const withoutTokens = text.replace(/(^|[\s\u00A0])#([^\s#]+)/g, (_match, lead) => {
    return lead ? lead : ''
  })
  return withoutTokens.replace(/\s{2,}/g, ' ')
}

export function stripLabelTokensFromHtml(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? ''
    const cleaned = stripLabelTokensFromText(text)
    if (cleaned !== text) node.textContent = cleaned
  }
  return div.innerHTML
}
