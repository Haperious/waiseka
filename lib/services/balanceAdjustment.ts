import type { Db, ObjectId } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'
import { MAX_DESCRIPTION_LENGTH, isTooFarAhead, parseDateInput } from '@/lib/transactionInput'
import { readBalance, roundMoney } from '@/lib/money'
import { cleanUserText } from '@/lib/text'
import { computeAssetBalance, computeOutstanding, getAccountActivityMap, utcDay } from '@/lib/services/accountBalance'

/**
 * Balance adjustments: the user types what their bank shows, and we save it as a
 * `type: 'adjustment'` transaction on that account - a checkpoint ("the bank showed X at
 * the end of this day", or "right now" when made on its own day - entries logged after it
 * that day count on top). The balance math (buildLedger) works out each checkpoint's
 * difference on every read, so later edits to older entries can't knock it off again.
 * The difference saved on the row is only a snapshot from when it was saved.
 */

/** Category stored on every adjustment. Lists show a translated label instead. */
export const ADJUSTMENT_CATEGORY = 'Balance adjustment'

export const BEFORE_OPENING_DATE_ERROR =
  "That date is before this account's opening balance date, which already covers it. Pick a later date, or move the opening balance date back in the account settings."

export { roundMoney }

/** A checkpoint is what the bank shows by then; tomorrow is allowed for users east of UTC. */
const MAX_DAYS_AHEAD = 1

/** Last moment of the date's UTC calendar day, so everything dated that day counts. */
export function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

/**
 * The account's figure as of the end of `date`: the balance for asset accounts, the amount
 * owed for credit cards. `excludeId` leaves out an adjustment that's being edited.
 */
export async function accountFigureAsOf(
  db: Db,
  userId: string,
  account: IAccount,
  date: Date,
  excludeId?: ObjectId,
): Promise<number> {
  const map = await getAccountActivityMap(db, userId, { asOf: endOfUtcDay(date), excludeTransactionId: excludeId })
  const activity = map.get(account._id.toString())
  const opening = account.openingBalance ?? 0
  const figure = account.type === 'credit' ? computeOutstanding(opening, activity) : computeAssetBalance(opening, activity)
  return roundMoney(figure)
}

export interface AdjustmentInput {
  targetBalance?: number
  date?: Date
  /** '' clears the note on an edit. */
  note?: string
}

/**
 * Checks the adjustment fields present in `body`. With `requireAll`, targetBalance and date
 * must both be there (create); otherwise absent fields are skipped (edit).
 */
export function readAdjustmentInput(
  body: Record<string, unknown>,
  { requireAll }: { requireAll: boolean },
): { input: AdjustmentInput } | { error: string } {
  const input: AdjustmentInput = {}

  if (body.targetBalance !== undefined || requireAll) {
    const v = readBalance(body.targetBalance)
    if (v === null) return { error: 'targetBalance must be a number' }
    input.targetBalance = v
  }

  if (body.date !== undefined || requireAll) {
    const date = parseDateInput(body.date)
    if (!date) return { error: 'date must be a valid date' }
    // A future-dated checkpoint swallowed every entry logged before its day, so spending
    // logged today never moved the balance
    if (isTooFarAhead(date, MAX_DAYS_AHEAD)) return { error: "date can't be in the future" }
    input.date = date
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') return { error: 'note must be text' }
    const note = cleanUserText(body.note)
    if (note.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `note must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    input.note = note
  } else if (body.note === null) {
    input.note = ''
  }

  return { input }
}

/** Start of the date's UTC calendar day. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Reads an account's openingBalanceDate from a request body. null clears it (count every
 * entry). A day ahead of now is allowed so a user east of UTC can pick their "today".
 */
export function readOpeningBalanceDate(value: unknown): { date: Date | null } | { error: string } {
  if (value === null) return { date: null }
  const date = parseDateInput(value)
  if (!date) return { error: 'openingBalanceDate must be a valid date' }
  if (isTooFarAhead(date, MAX_DAYS_AHEAD)) {
    return { error: "openingBalanceDate can't be in the future" }
  }
  return { date }
}

/** True when `date` falls on a day before the account's opening balance date. */
export function isBeforeOpeningDate(account: Pick<IAccount, 'openingBalanceDate'>, date: Date): boolean {
  return !!account.openingBalanceDate && utcDay(date) < utcDay(new Date(account.openingBalanceDate))
}

/** Change needed to go from `current` to `target`, or null when they already match. */
export function adjustmentDelta(current: number, target: number): number | null {
  const delta = roundMoney(target - current)
  return delta === 0 ? null : delta
}
