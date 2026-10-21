import type { Db, ObjectId } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'
import { utcDay } from '@/lib/services/accountBalance'
import { endOfUtcDay } from '@/lib/services/balanceAdjustment'

/**
 * Balance checks: the user confirms WaiseKa matches their bank. Each account remembers
 * the last check, which drives the "Verified 3 days ago" badge and the reminder to check
 * again. If an older entry changes afterwards, the figure on the checked day no longer
 * equals what the user confirmed - the account is flagged as changed since the check.
 */

/** A check older than this is due again - the weekly nudge. */
export const VERIFY_STALE_DAYS = 7

export type VerificationStatus = 'fresh' | 'stale' | 'never' | 'changed'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `figureOnCheckedDay` is the account's figure today at the end of lastVerifiedDate
 * (undefined when the last check has no figure to compare, e.g. adding the account).
 */
export function verificationStatus(
  account: Pick<IAccount, 'lastVerifiedAt' | 'lastVerifiedBalance'>,
  figureOnCheckedDay: number | undefined,
  now: Date = new Date(),
): VerificationStatus {
  if (!account.lastVerifiedAt) return 'never'
  if (account.lastVerifiedBalance != null && figureOnCheckedDay !== undefined
    && Math.abs(figureOnCheckedDay - account.lastVerifiedBalance) >= 0.005) {
    return 'changed'
  }
  const age = now.getTime() - new Date(account.lastVerifiedAt).getTime()
  return age > VERIFY_STALE_DAYS * DAY_MS ? 'stale' : 'fresh'
}

/** Whole days since the last check, or null when never checked. */
export function verifiedDaysAgo(account: Pick<IAccount, 'lastVerifiedAt'>, now: Date = new Date()): number | null {
  if (!account.lastVerifiedAt) return null
  return Math.max(0, Math.floor((now.getTime() - new Date(account.lastVerifiedAt).getTime()) / DAY_MS))
}

/** Window and count for "this account keeps needing adjustments". */
export const PATTERN_DAYS = 90
export const PATTERN_MIN_ADJUSTMENTS = 3

export interface AdjustmentPattern {
  /** Adjustments that actually changed something in the window. */
  count: number
  /** Their total difference (bank minus WaiseKa, in the account's own terms). */
  net: number
  days: number
}

/**
 * An account that needed several adjustments lately usually has entries that never get
 * logged (or get logged twice) - worth telling the user, since adjusting again only hides
 * it. Null when there's no pattern. Zero-difference checkpoints don't count.
 */
export function adjustmentPattern(
  checkpoints: { day: string; delta: number }[],
  now: Date = new Date(),
): AdjustmentPattern | null {
  const since = new Date(now.getTime() - PATTERN_DAYS * DAY_MS).toISOString().slice(0, 10)
  const recent = checkpoints.filter((c) => c.day >= since && Math.abs(c.delta) >= 0.005)
  if (recent.length < PATTERN_MIN_ADJUSTMENTS) return null
  const net = Math.round(recent.reduce((sum, c) => sum + c.delta, 0) * 100) / 100
  return { count: recent.length, net, days: PATTERN_DAYS }
}

/** How long after a card statement closes we keep asking to check it. */
export const STATEMENT_CHECK_DAYS = 20

/**
 * The most recent statement closing date on or before `today` (UTC day), with the
 * statement day clamped to short months like dueDay. Null without a statement day.
 */
export function lastStatementDate(statementDay: number | null | undefined, today: Date): Date | null {
  if (statementDay == null) return null
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const clamp = (year: number, month: number) =>
    Math.min(statementDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  const thisMonth = new Date(Date.UTC(y, m, clamp(y, m), 12))
  if (thisMonth.getUTCDate() <= today.getUTCDate()) return thisMonth
  return new Date(Date.UTC(y, m - 1, clamp(y, m - 1), 12))
}

/**
 * yyyy-MM-dd of a card statement that closed recently and hasn't been checked yet, or
 * null. A statement gives one exact figure for one day - the easiest reconcile point.
 * Checked means a check (or adjustment) on or after the closing day.
 */
export function statementCheckDue(
  account: Pick<IAccount, 'type' | 'statementDay' | 'lastVerifiedDate' | 'isArchived'>,
  now: Date = new Date(),
): string | null {
  if (account.type !== 'credit' || account.isArchived) return null
  const closed = lastStatementDate(account.statementDay, now)
  if (!closed) return null
  if (now.getTime() - closed.getTime() > STATEMENT_CHECK_DAYS * DAY_MS) return null
  const closedDay = utcDay(closed)
  if (account.lastVerifiedDate && utcDay(new Date(account.lastVerifiedDate)) >= closedDay) return null
  return closedDay
}

/** Probe days for getAccountLedger: the day each account was last checked with a figure. */
export function verificationProbes(accounts: Pick<IAccount, '_id' | 'lastVerifiedBalance' | 'lastVerifiedDate'>[]): Map<string, string> {
  const probes = new Map<string, string>()
  for (const a of accounts) {
    if (a.lastVerifiedBalance != null && a.lastVerifiedDate) probes.set(a._id.toString(), utcDay(new Date(a.lastVerifiedDate)))
  }
  return probes
}

/**
 * Saves a check (figure `balance` at the end of `date`). A check for an older day than
 * the one already saved is ignored, so back-dating an adjustment never hides a newer check.
 */
export async function recordVerification(
  db: Db,
  userId: string,
  accountId: ObjectId,
  date: Date,
  balance: number,
): Promise<void> {
  await db.collection<IAccount>('accounts').updateOne(
    {
      _id: accountId,
      userId,
      $or: [{ lastVerifiedDate: null }, { lastVerifiedDate: { $lte: endOfUtcDay(date) } }],
    },
    { $set: { lastVerifiedAt: new Date(), lastVerifiedBalance: balance, lastVerifiedDate: date } },
  )
}
