import type { Db, ObjectId } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'
import { MAX_DESCRIPTION_LENGTH, parseDateInput } from '@/lib/transactionInput'
import { computeAssetBalance, computeOutstanding, getAccountActivityMap } from '@/lib/services/accountBalance'

/**
 * Balance adjustments: the user types what their bank shows, and we save the difference
 * as a `type: 'adjustment'` transaction on that account. The difference is worked out on
 * the server, against the balance as of the adjustment's date, so it can't be spoofed.
 */

/** Category stored on every adjustment. Lists show a translated label instead. */
export const ADJUSTMENT_CATEGORY = 'Balance adjustment'

/** Upper bound on a typed balance - well past any real account, stops absurd values. */
const MAX_BALANCE = 1_000_000_000_000

export const roundMoney = (n: number) => Math.round(n * 100) / 100

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
    const v = body.targetBalance
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_BALANCE) {
      return { error: 'targetBalance must be a number' }
    }
    input.targetBalance = roundMoney(v)
  }

  if (body.date !== undefined || requireAll) {
    const date = parseDateInput(body.date)
    if (!date) return { error: 'date must be a valid date' }
    input.date = date
  }

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') return { error: 'note must be text' }
    if (body.note.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `note must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` }
    }
    input.note = body.note.trim()
  } else if (body.note === null) {
    input.note = ''
  }

  return { input }
}

/** Change needed to go from `current` to `target`, or null when they already match. */
export function adjustmentDelta(current: number, target: number): number | null {
  const delta = roundMoney(target - current)
  return delta === 0 ? null : delta
}
