import { parseTransactionDate } from '@/lib/utils'
import type { ITransaction } from '@/lib/models/Transaction'

/*
 * Field checks shared by the transaction routes (single add, edit, import). Request bodies
 * are client-controlled, so each field's type and size is checked before it's stored -
 * an object where a string belongs would otherwise be saved as-is.
 */

/** Types the add/edit routes accept. Transfers are created only by /api/transfers. */
export const ENTRY_TYPES = ['income', 'expense', 'savings'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

export const MAX_CATEGORY_LENGTH = 100
export const MAX_DESCRIPTION_LENGTH = 500
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 50

export function isEntryType(value: unknown): value is EntryType {
  return ENTRY_TYPES.includes(value as EntryType)
}

/** yyyy-MM-dd (anchored to UTC noon) or a full ISO string; null when it isn't a usable date. */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = parseTransactionDate(value)
  return Number.isNaN(date.getTime()) ? null : date
}

type Fields = Partial<Pick<ITransaction, 'type' | 'category' | 'description' | 'date' | 'tags'>>

/**
 * Checks whichever of type, category, description, date and tags are present in `body`
 * (absent ones are skipped, so edits can send only what changed). Returns the cleaned
 * fields, or the first error message.
 */
export function readTransactionFields(body: Record<string, unknown>): { fields: Fields } | { error: string } {
  const fields: Fields = {}

  if (body.type !== undefined) {
    if (!isEntryType(body.type)) return { error: `type must be one of ${ENTRY_TYPES.join(', ')}` }
    fields.type = body.type
  }

  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !body.category.trim()) return { error: 'category is required' }
    if (body.category.length > MAX_CATEGORY_LENGTH) {
      return { error: `category must be ${MAX_CATEGORY_LENGTH} characters or fewer` }
    }
    fields.category = body.category.trim()
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') return { error: 'description must be text' }
    if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    fields.description = body.description
  }

  if (body.date !== undefined) {
    const date = parseDateInput(body.date)
    if (!date) return { error: 'date must be a valid date' }
    fields.date = date
  }

  if (body.tags !== undefined) {
    const { tags } = body
    if (
      !Array.isArray(tags) || tags.length > MAX_TAGS ||
      !tags.every((tag) => typeof tag === 'string' && tag.length <= MAX_TAG_LENGTH)
    ) {
      return { error: `tags must be up to ${MAX_TAGS} short text labels` }
    }
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
    page: Math.max(1, int(searchParams.get('page'), 1)),
    limit: Math.min(100, Math.max(1, int(searchParams.get('limit'), defaultLimit))),
  }
}
