import type { ITransaction } from '@/lib/models/Transaction'
import { readAmount } from '@/lib/money'
import { cleanUserText } from '@/lib/text'

/*
 * Field checks shared by the transaction routes (single add, edit, bulk, import). Request
 * bodies are client-controlled, so each field's type and size is checked before it's
 * stored - an object where a string belongs would otherwise be saved as-is.
 */

/** Types the add/edit routes accept. Transfers are created only by /api/transfers. */
export const ENTRY_TYPES = ['income', 'expense', 'savings'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

export const MAX_CATEGORY_LENGTH = 100
export const MAX_DESCRIPTION_LENGTH = 500
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 50

/** Entries can be logged ahead (a bill due soon), but not years ahead. */
export const MAX_ENTRY_DAYS_AHEAD = 366
// Outside this, a "date" is a typo (year 0002 or 20255) and breaks year pickers and reports
const MIN_YEAR = 1900
const MAX_YEAR = 2200

export function isEntryType(value: unknown): value is EntryType {
  return ENTRY_TYPES.includes(value as EntryType)
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})/

/** True when yyyy-MM-dd names a real calendar day (no Feb 30, no month 13). */
function isRealDay(ymd: string): boolean {
  const date = new Date(`${ymd}T12:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === ymd
}

/**
 * yyyy-MM-dd (anchored to UTC noon, so the day is the same in every timezone) or a full
 * ISO date-time; null when it isn't a real date. `new Date('2025-02-30')` quietly rolls
 * into March, so the calendar day is checked as well.
 */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const ymd = YMD.exec(text)
  if (!ymd || !isRealDay(ymd[0])) return null
  const year = Number(ymd[1])
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (text.length === 10) return new Date(`${text}T12:00:00.000Z`)
  if (text[10] !== 'T') return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * True when `date` falls on a (UTC) day more than `days` days after today. Whole days, so
 * "tomorrow" is allowed all day - a yyyy-MM-dd date is noon, which is more than 24 hours
 * away whenever it's still morning.
 */
export function isTooFarAhead(date: Date, days: number, now = new Date()): boolean {
  const lastDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 23, 59, 59, 999)
  return date.getTime() > lastDay
}

/** Tags cleaned: blanks dropped, duplicates removed. null when it isn't a short list of text. */
function readTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null
  const tags: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') return null
    const tag = cleanUserText(raw)
    if (tag.length > MAX_TAG_LENGTH) return null
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags
}

type Fields = Partial<Pick<ITransaction, 'type' | 'amount' | 'category' | 'description' | 'date' | 'tags'>>

/**
 * Checks whichever of type, amount, category, description, date and tags are present in
 * `body` (absent ones are skipped, so edits can send only what changed). Returns the
 * cleaned fields, or the first error message.
 */
export function readTransactionFields(body: Record<string, unknown>): { fields: Fields } | { error: string } {
  const fields: Fields = {}

  if (body.type !== undefined) {
    if (!isEntryType(body.type)) return { error: `type must be one of ${ENTRY_TYPES.join(', ')}` }
    fields.type = body.type
  }

  if (body.amount !== undefined) {
    const amount = readAmount(body.amount)
    if (amount === null) return { error: 'amount must be a positive number up to 1,000,000,000,000' }
    fields.amount = amount
  }

  if (body.category !== undefined) {
    const category = typeof body.category === 'string' ? cleanUserText(body.category) : ''
    if (!category) return { error: 'category is required' }
    if (category.length > MAX_CATEGORY_LENGTH) {
      return { error: `category must be ${MAX_CATEGORY_LENGTH} characters or fewer` }
    }
    fields.category = category
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') return { error: 'description must be text' }
    const description = cleanUserText(body.description)
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    fields.description = description
  }

  if (body.date !== undefined) {
    const date = parseDateInput(body.date)
    if (!date) return { error: 'date must be a valid date' }
    if (isTooFarAhead(date, MAX_ENTRY_DAYS_AHEAD)) return { error: 'date can be at most a year ahead' }
    fields.date = date
  }

  if (body.tags !== undefined) {
    const tags = readTags(body.tags)
    if (!tags) return { error: `tags must be up to ${MAX_TAGS} short text labels` }
    fields.tags = tags
  }

  return { fields }
}

/** `?page=` / `?limit=` as safe integers: page ≥ 1, limit 1..100 (bad input falls back to the defaults). */
export function readPaging(searchParams: URLSearchParams, defaultLimit = 20): { page: number; limit: number } {
  const int = (raw: string | null, fallback: number) => {
    const n = Number.parseInt(raw ?? '', 10)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    // Capped so skip() stays a sane number however large ?page= is
    page: Math.min(100_000, Math.max(1, int(searchParams.get('page'), 1))),
    limit: Math.min(100, Math.max(1, int(searchParams.get('limit'), defaultLimit))),
  }
}
