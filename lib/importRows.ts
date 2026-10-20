import { isEntryType, MAX_CATEGORY_LENGTH, MAX_DESCRIPTION_LENGTH, type EntryType } from '@/lib/transactionInput'

/**
 * Validation for the rows /api/import/confirm receives. They come back from the review
 * table in the browser, so every field is client-controlled and checked like any other
 * transaction input before it reaches the database.
 */

export const MAX_IMPORT_ROWS = 500

export interface ImportRow {
  amount: number
  type: EntryType
  category: string
  description: string
  date: Date
  isRecurring: boolean
}

/**
 * The row's fields, cleaned, or null when it can't be saved: no positive amount, an
 * unknown type, an unreadable date, or a date before the user's history window.
 * A missing date means today, as before.
 */
export function sanitizeImportRow(raw: unknown, windowStart: Date, now: Date = new Date()): ImportRow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>

  const { amount } = row
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null

  const type = row.type ?? 'expense'
  if (!isEntryType(type)) return null

  if (row.date !== undefined && row.date !== null && typeof row.date !== 'string') return null
  const date = row.date ? new Date(row.date) : now
  if (Number.isNaN(date.getTime()) || date < windowStart) return null

  const category = typeof row.category === 'string' && row.category.trim()
    ? row.category.trim().slice(0, MAX_CATEGORY_LENGTH)
    : 'Others'
  const description = typeof row.description === 'string'
    ? row.description.slice(0, MAX_DESCRIPTION_LENGTH)
    : ''

  return {
    amount,
    type,
    category,
    description,
    date,
    isRecurring: row.isRecurring === true,
  }
}

/** Key for spotting a row that was already imported: same day-time, amount and description. */
export function importDedupeKey(row: { date: Date; amount: number; description?: string | null }): string {
  return `${row.date.getTime()}|${row.amount}|${row.description ?? ''}`
}
