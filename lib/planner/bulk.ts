import type { PlannerItem, PlannerItemType } from './types'

/*
 * "Add several" in the Planner: many income and expense rows typed in one go. Pure so the
 * form and the tests share the same rules. The server re-checks every item on save.
 */

export interface BulkRow {
  /** Client key for React and focus; becomes the item id. */
  key: string
  type: PlannerItemType
  /** Raw text from the amount field. */
  amount: string
  category: string
  note: string
  /** yyyy-MM-dd or '' for no date. */
  date: string
}

export type BulkRowErrors = Partial<Record<'amount' | 'category' | 'date', string>>

export interface BulkMessages {
  amount: string
  category: string
  date: string
}

/** A row nothing was typed into is skipped, not an error. */
export function isBlankRow(r: BulkRow): boolean {
  return !r.amount.trim() && !r.category.trim() && !r.note.trim() && !r.date
}

/**
 * Turns the typed rows into planner items. Blank rows are dropped; any other row with a
 * problem gets an entry in `errors` (by row key) and no items are returned.
 */
export function buildBulkItems(
  rows: BulkRow[],
  { maxDate, messages }: { maxDate: string; messages: BulkMessages },
): { items: PlannerItem[]; errors: Record<string, BulkRowErrors> } {
  const items: PlannerItem[] = []
  const errors: Record<string, BulkRowErrors> = {}
  for (const r of rows) {
    if (isBlankRow(r)) continue
    const e: BulkRowErrors = {}
    const n = Number(r.amount)
    if (!r.amount.trim() || !Number.isFinite(n) || n <= 0) e.amount = messages.amount
    if (!r.category.trim()) e.category = messages.category
    if (r.date && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date < '1900-01-01' || r.date > maxDate)) e.date = messages.date
    if (Object.keys(e).length > 0) {
      errors[r.key] = e
      continue
    }
    const note = r.note.trim()
    items.push({
      id: r.key,
      type: r.type,
      amount: Math.round(n * 100) / 100,
      category: r.category.trim(),
      ...(note ? { note } : {}),
      date: r.date || null,
      enabled: true,
      done: false,
      source: 'manual',
    })
  }
  return Object.keys(errors).length > 0 ? { items: [], errors } : { items, errors }
}

/** Income and expense totals of the rows that would be added, for the footer. */
export function bulkTotals(rows: BulkRow[]): { income: number; expense: number; count: number } {
  let income = 0
  let expense = 0
  let count = 0
  for (const r of rows) {
    if (isBlankRow(r)) continue
    const n = Number(r.amount)
    if (!Number.isFinite(n) || n <= 0) continue
    count++
    if (r.type === 'income') income += n
    else expense += n
  }
  return { income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100, count }
}
