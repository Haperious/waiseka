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
