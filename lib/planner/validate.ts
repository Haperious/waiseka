import { ObjectId } from 'mongodb'
import { readAmount } from '@/lib/money'
import { cleanText, readOptionalText } from '@/lib/request'
import { MAX_PLANNER_ITEMS, MAX_PLANNER_NAME, MAX_PLANNER_NOTE, PLANNER_MAX_DAYS_AHEAD } from '@/lib/constants'
import { addDays, isDay } from './days'
import { PLANNER_ITEM_SOURCES, type PlannerItem } from './types'

/*
 * Checks for Planner request bodies. Everything is client-controlled, so each field's type
 * and size is checked and only known fields are kept - nothing else reaches the database.
 * Server only (it pulls in mongodb and next/server); the browser takes the limits from
 * lib/constants.
 */

const MAX_SCENARIO_NAME = MAX_PLANNER_NAME
const MAX_ITEM_NOTE = MAX_PLANNER_NOTE
const MAX_CATEGORY = 100
const MAX_SOURCE_REF = 200
const MAX_ACCOUNT_IDS = 100
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/

export type Checked<T> = { value: T } | { error: string }

export function readScenarioName(value: unknown): Checked<string> {
  const name = cleanText(value, MAX_SCENARIO_NAME)
  return name ? { value: name } : { error: `name must be 1-${MAX_SCENARIO_NAME} characters` }
}

/** An end date from today (a day of slack for timezones) up to PLANNER_MAX_DAYS_AHEAD ahead. */
export function readEndDate(value: unknown, today: string): Checked<string> {
  if (!isDay(value)) return { error: 'endDate must be a date like 2026-11-30' }
  if (value < addDays(today, -1)) return { error: 'endDate must be today or later' }
  if (value > addDays(today, PLANNER_MAX_DAYS_AHEAD)) return { error: `endDate must be within ${PLANNER_MAX_DAYS_AHEAD} days` }
  return { value }
}

/** Account ids as strings, de-duplicated. Which ones belong to the user is checked by the caller. */
export function readAccountIds(value: unknown): Checked<string[]> {
  if (!Array.isArray(value) || value.length > MAX_ACCOUNT_IDS) return { error: 'accountIds must be a list of account ids' }
  const ids: string[] = []
  for (const id of value) {
    if (typeof id !== 'string' || !ObjectId.isValid(id) || id.length !== 24) return { error: 'accountIds must be a list of account ids' }
    if (!ids.includes(id)) ids.push(id)
  }
  return { value: ids }
}

function readItem(raw: unknown, index: number): Checked<PlannerItem> {
  const at = `items[${index}]`
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { error: `${at} must be an object` }
  const r = raw as Record<string, unknown>

  if (typeof r.id !== 'string' || !ITEM_ID.test(r.id)) return { error: `${at}.id is invalid` }
  if (r.type !== 'income' && r.type !== 'expense') return { error: `${at}.type must be income or expense` }
  const source = r.source ?? 'manual'
  if (!PLANNER_ITEM_SOURCES.includes(source as PlannerItem['source'])) return { error: `${at}.source is invalid` }
  const live = source === 'budget' || source === 'card'
  if (live && r.type !== 'expense') return { error: `${at}: budget and card items are expenses` }

  // Budget and card amounts are worked out live - whatever was sent is ignored
  let amount = 0
  if (!live) {
    const a = readAmount(r.amount)
    if (a === null) return { error: `${at}.amount must be a positive number up to 1,000,000,000,000` }
    amount = a
  }

  const category = cleanText(r.category, MAX_CATEGORY)
  if (!category) return { error: `${at}.category must be 1-${MAX_CATEGORY} characters` }
  const note = readOptionalText(r.note, MAX_ITEM_NOTE)
  if (note === null) return { error: `${at}.note must be up to ${MAX_ITEM_NOTE} characters` }

  let date: string | null = null
  if (r.date !== undefined && r.date !== null && r.date !== '') {
    if (!isDay(r.date)) return { error: `${at}.date must be a date like 2026-11-30` }
    date = r.date
  }
  if (r.enabled !== undefined && typeof r.enabled !== 'boolean') return { error: `${at}.enabled must be true or false` }
  if (r.done !== undefined && typeof r.done !== 'boolean') return { error: `${at}.done must be true or false` }

  let sourceRef: string | undefined
  if (source !== 'manual') {
    if (typeof r.sourceRef !== 'string' || !r.sourceRef || r.sourceRef.length > MAX_SOURCE_REF) {
      return { error: `${at}.sourceRef is required for ${source} items` }
    }
    if (live && !ObjectId.isValid(r.sourceRef)) return { error: `${at}.sourceRef is invalid` }
    sourceRef = r.sourceRef
  }

  return {
    value: {
      id: r.id,
      type: r.type,
      amount,
      category,
      ...(note ? { note } : {}),
      date: live ? null : date,
      enabled: r.enabled !== false,
      done: r.done === true,
      source: source as PlannerItem['source'],
      ...(sourceRef ? { sourceRef } : {}),
    },
  }
}

/** The full item list; ids must be unique and a budget or card can only be in it once. */
export function readItems(value: unknown): Checked<PlannerItem[]> {
  if (!Array.isArray(value)) return { error: 'items must be a list' }
  if (value.length > MAX_PLANNER_ITEMS) return { error: `A plan can have up to ${MAX_PLANNER_ITEMS} items` }
  const items: PlannerItem[] = []
  const ids = new Set<string>()
  const linked = new Set<string>()
  for (let i = 0; i < value.length; i++) {
    const checked = readItem(value[i], i)
    if ('error' in checked) return checked
    const item = checked.value
    if (ids.has(item.id)) return { error: `items[${i}].id is repeated` }
    ids.add(item.id)
    if (item.sourceRef && item.source !== 'manual') {
      const key = `${item.source}:${item.sourceRef}`
      if (linked.has(key)) continue // the same budget, card or suggestion twice - keep the first
      linked.add(key)
    }
    items.push(item)
  }
  return { value: items }
}
