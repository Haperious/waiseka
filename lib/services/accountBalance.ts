import { Db, ObjectId } from 'mongodb'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IAccount } from '@/lib/models/Account'

export interface AccountActivity {
  income: number
  expense: number
  savings: number
  /** Total transferred INTO this account (destination leg of transfers). */
  transferIn: number
  /** Total transferred OUT of this account (source leg of transfers). */
  transferOut: number
  /**
   * Sum of balance adjustments (signed). Added straight onto the balance for asset
   * accounts and onto the outstanding amount for credit accounts. Optional so older
   * callers that build activity by hand keep working (missing = 0).
   */
  adjustment?: number
}

function emptyActivity(): AccountActivity {
  return { income: 0, expense: 0, savings: 0, transferIn: 0, transferOut: 0, adjustment: 0 }
}

/**
 * A day to report an account's figure for. `at` is when the user checked it: entries
 * logged later that same day are left out, so they don't look like a change to the check.
 */
export type Probe = string | { day: string; at?: Date | null }

export interface ActivityOptions {
  /** Only count transactions dated on or before this moment (balance "as of" a date). */
  asOf?: Date
  /** Leave this transaction out (used when re-working an adjustment being edited). */
  excludeTransactionId?: ObjectId
  /** accountId -> probe: also work out each account's figure on that day. */
  probes?: Map<string, Probe>
}

/** UTC calendar day as yyyy-MM-dd - the same day Mongo's $dateToString gives by default. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

type ActivityKind = 'income' | 'expense' | 'savings' | 'transferIn' | 'transferOut'

/** One aggregated row: everything of one kind on one account on one day. */
export interface DayActivityRow {
  accountId: string
  day: string
  kind: ActivityKind
  total: number
  /**
   * When the entries were logged. Only set on days that have a same-day adjustment or
   * check, where it decides which side of that moment they fall on. Unset = before it.
   */
  createdAt?: Date | null
}

/** A balance adjustment, read as a checkpoint: "the bank showed adjustmentTarget on date". */
export interface CheckpointRow {
  _id: { toString(): string }
  accountId: { toString(): string }
  date: Date
  adjustmentTarget?: number | null
  /** Only used for old rows saved without a target. */
  adjustmentDelta?: number | null
  /** When the balance was read (adjustmentAt, else createdAt). */
  adjustmentAt?: Date | null
  createdAt?: Date | null
}

/**
 * The moment within `day` an adjustment or check stands for, as epoch ms. One made on its
 * own day means "the balance right now", so entries logged after it that day come on top.
 * One made later (or without a time) means "the balance at the end of that day".
 */
export function momentOnDay(day: string, at: Date | null | undefined): number {
  if (!at) return Infinity
  const ms = new Date(at).getTime()
  return Number.isFinite(ms) && ms <= Date.parse(`${day}T23:59:59.999Z`) ? ms : Infinity
}

export type LedgerAccount = Pick<IAccount, 'type' | 'openingBalance' | 'openingBalanceDate'> & { _id: { toString(): string } }

export interface AccountLedger {
  /** Per-account totals. `adjustment` holds the live sum of every checkpoint's difference. */
  activity: Map<string, AccountActivity>
  /** Each adjustment's live difference, keyed by its transaction id. */
  adjustmentDeltas: Map<string, number>
  /** The figure at the end of each requested probe day, keyed by account id. */
  probeFigures: Map<string, number>
  /** Every counted checkpoint with its live difference, oldest first per account. */
  checkpointDeltas: { accountId: string; day: string; delta: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** How one kind of activity moves the account's figure (balance, or amount owed for cards). */
function figureSign(isCredit: boolean, kind: ActivityKind): number {
  if (isCredit) return kind === 'expense' || kind === 'transferOut' ? 1 : -1
  return kind === 'income' || kind === 'transferIn' ? 1 : -1
}

/**
 * Pure part of the ledger, kept apart so it can be tested without a database.
 *
 * Two rules keep WaiseKa's balance tied to the bank's:
 *
 * 1. Opening date. The opening balance is what the bank showed on openingBalanceDate, so
 *    anything dated before that day is already inside it and is skipped. Accounts without
 *    the field (made before it existed) skip nothing.
 *
 * 2. Checkpoints. An adjustment means "the bank showed X at this point". Its difference
 *    is worked out here on every read from the history before it, instead of being frozen
 *    when it was saved. So adding, editing or deleting an older entry later can't knock
 *    the balance off again - the checkpoint absorbs it. Checkpoints dated before the
 *    opening date are ignored (difference 0).
 *
 *    "This point" is the end of its day, except for an adjustment made on its own day:
 *    entries logged after it that day happened after the user read the balance, so they
 *    count on top of it (see momentOnDay). Without that, "set balance to 200, then
 *    transfer 1,000 in" left the account at 200.
 */
export function buildLedger(
  accounts: LedgerAccount[],
  rows: DayActivityRow[],
  checkpoints: CheckpointRow[],
  /** accountId -> probe: also report the account's figure on that day. */
  probes: Map<string, Probe> = new Map(),
): AccountLedger {
  const accountById = new Map(accounts.map((a) => [a._id.toString(), a]))
  const floorOf = (id: string) => {
    const d = accountById.get(id)?.openingBalanceDate
    return d ? utcDay(new Date(d)) : null
  }

  const activity = new Map<string, AccountActivity>()
  // Change to the figure per account per day, for walking up to each checkpoint. `net`
  // has no time (counts before any moment that day); `timed` is split around moments.
  type DayNet = { net: number; timed: { at: number; v: number }[]; netAdded: boolean; addedUpTo: number }
  const dailyNet = new Map<string, Map<string, DayNet>>()

  for (const row of rows) {
    const floor = floorOf(row.accountId)
    if (floor && row.day < floor) continue
    const entry = activity.get(row.accountId) ?? emptyActivity()
    entry[row.kind] += row.total
    activity.set(row.accountId, entry)

    const account = accountById.get(row.accountId)
    if (!account) continue
    const days = dailyNet.get(row.accountId) ?? new Map<string, DayNet>()
    const d = days.get(row.day) ?? { net: 0, timed: [], netAdded: false, addedUpTo: -Infinity }
    const v = figureSign(account.type === 'credit', row.kind) * row.total
    const at = row.createdAt ? new Date(row.createdAt).getTime() : NaN
    if (Number.isFinite(at)) d.timed.push({ at, v })
    else d.net += v
    days.set(row.day, d)
    dailyNet.set(row.accountId, days)
  }

  // Checkpoints grouped per account, keeping their (date, createdAt) order
  const byAccount = new Map<string, CheckpointRow[]>()
  for (const cp of checkpoints) {
    const key = cp.accountId.toString()
    const list = byAccount.get(key) ?? []
    list.push(cp)
    byAccount.set(key, list)
  }

  const adjustmentDeltas = new Map<string, number>()
  const probeFigures = new Map<string, number>()
  const checkpointDeltas: AccountLedger['checkpointDeltas'] = []
  const walked = new Set([...byAccount.keys(), ...probes.keys()])
  for (const accountId of walked) {
    const list = byAccount.get(accountId) ?? []
    const account = accountById.get(accountId)
    const floor = floorOf(accountId)
    const days = [...(dailyNet.get(accountId) ?? new Map<string, DayNet>())].sort(([a], [b]) => (a < b ? -1 : 1))
    let running = account?.openingBalance ?? 0
    let next = 0
    let sum = 0

    // Adds every day before `day`, and on `day` itself whatever was logged by `upTo`
    const walkTo = (day: string, upTo: number) => {
      for (; next < days.length && days[next][0] <= day; next++) {
        const [d, n] = days[next]
        const limit = d < day ? Infinity : upTo
        if (!n.netAdded) { running += n.net; n.netAdded = true }
        for (const t of n.timed) if (t.at > n.addedUpTo && t.at <= limit) running += t.v
        n.addedUpTo = Math.max(n.addedUpTo, limit)
        if (limit !== Infinity) return // rest of this day comes after the moment
      }
    }

    // Checkpoints and the probe, walked in time order. At the same moment a checkpoint
    // goes first, so a probe on its day includes it.
    type Event = { day: string; at: number; cp?: CheckpointRow }
    const events: Event[] = list.map((cp) => {
      const day = utcDay(new Date(cp.date))
      return { day, at: momentOnDay(day, cp.adjustmentAt ?? cp.createdAt), cp }
    })
    const probe = probes.get(accountId)
    if (probe !== undefined) {
      const day = typeof probe === 'string' ? probe : probe.day
      events.push({ day, at: typeof probe === 'string' ? Infinity : momentOnDay(day, probe.at) })
    }
    // Stable sort keeps the (date, createdAt) order checkpoints arrive in
    events.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.at === b.at ? 0 : a.at < b.at ? -1 : 1))

    for (const { day, at, cp } of events) {
      walkTo(day, at)
      if (!cp) {
        probeFigures.set(accountId, round2(running))
        continue
      }
      if (floor && day < floor) {
        adjustmentDeltas.set(cp._id.toString(), 0)
        continue
      }

      let delta: number
      if (account && cp.adjustmentTarget != null) {
        delta = round2(cp.adjustmentTarget - running)
        running = cp.adjustmentTarget
      } else {
        // Unknown account or an old row without a target: keep its saved difference
        delta = cp.adjustmentDelta ?? 0
        running += delta
      }
      sum += delta
      adjustmentDeltas.set(cp._id.toString(), delta)
      checkpointDeltas.push({ accountId, day, delta })
    }

    if (list.length > 0) {
      const entry = activity.get(accountId) ?? emptyActivity()
      entry.adjustment = round2(sum)
      activity.set(accountId, entry)
    }
  }

  return { activity, adjustmentDeltas, probeFigures, checkpointDeltas }
}

/**
 * Loads a user's accounts, per-day activity and adjustments, then builds the ledger.
 * Balances are never written to the account document, only computed on read - the same
 * "derived over stored" pattern used for Budget.spent.
 *
 * Archived transactions are counted on purpose. Archiving only hides entries past the
 * plan's history window from lists and reports; the money still moved, so dropping them
 * here would make balances jump when they're archived. (Deleting is a hard delete.)
 */
export async function getAccountLedger(
  db: Db,
  userId: string,
  options: ActivityOptions = {},
): Promise<AccountLedger> {
  const col = db.collection<ITransaction>('transactions')
  const extra: Record<string, unknown> = {}
  if (options.asOf) extra.date = { $lte: options.asOf }
  if (options.excludeTransactionId) extra._id = { $ne: options.excludeTransactionId }
  const day = { $dateToString: { format: '%Y-%m-%d', date: '$date' } }

  const [accounts, checkpoints] = await Promise.all([
    db.collection<IAccount>('accounts')
      .find({ userId }, { projection: { type: 1, openingBalance: 1, openingBalanceDate: 1 } })
      .toArray(),
    col
      .find(
        { userId, type: 'adjustment', accountId: { $ne: null }, ...extra },
        { projection: { accountId: 1, date: 1, adjustmentTarget: 1, adjustmentDelta: 1, adjustmentAt: 1, createdAt: 1 } },
      )
      .sort({ date: 1, createdAt: 1 })
      .toArray(),
  ])

  // Days holding a same-day adjustment or check: there, entries are kept apart by the
  // time they were logged so buildLedger can tell which side of that moment they fall on.
  // Every other day is still summed in one row.
  const timedDays = new Set<string>()
  for (const cp of checkpoints) {
    const d = utcDay(new Date(cp.date))
    if (momentOnDay(d, cp.adjustmentAt ?? cp.createdAt) !== Infinity) timedDays.add(d)
  }
  for (const probe of options.probes?.values() ?? []) {
    if (typeof probe !== 'string' && momentOnDay(probe.day, probe.at) !== Infinity) timedDays.add(probe.day)
  }
  const at = timedDays.size > 0 ? { at: { $cond: [{ $in: [day, [...timedDays]] }, '$createdAt', null] } } : {}

  const [directRows, transferRows] = await Promise.all([
    col.aggregate([
      {
        $match: {
          userId,
          type: { $in: ['income', 'expense', 'savings'] },
          accountId: { $ne: null },
          ...extra,
        },
      },
      { $group: { _id: { accountId: '$accountId', type: '$type', day, ...at }, total: { $sum: '$amount' } } },
    ]).toArray(),
    col.aggregate([
      {
        $match: {
          userId,
          type: 'transfer',
          ...extra,
        },
      },
      {
        $facet: {
          out: [
            { $match: { fromAccountId: { $ne: null } } },
            { $group: { _id: { accountId: '$fromAccountId', day, ...at }, total: { $sum: '$amount' } } },
          ],
          in: [
            { $match: { toAccountId: { $ne: null } } },
            { $group: { _id: { accountId: '$toAccountId', day, ...at }, total: { $sum: '$amount' } } },
          ],
        },
      },
    ]).toArray(),
  ])

  type GroupRow = { _id: { accountId: { toString(): string }; type?: string; day: string; at?: Date | null }; total: number }
  const rows: DayActivityRow[] = []
  const toRow = (r: GroupRow, kind: ActivityKind): DayActivityRow =>
    ({ accountId: r._id.accountId.toString(), day: r._id.day, kind, total: r.total, createdAt: r._id.at ?? null })
  for (const r of directRows as unknown as GroupRow[]) rows.push(toRow(r, r._id.type as ActivityKind))
  const facet = (transferRows[0] ?? { out: [], in: [] }) as unknown as { out?: GroupRow[]; in?: GroupRow[] }
  for (const r of facet.out ?? []) rows.push(toRow(r, 'transferOut'))
  for (const r of facet.in ?? []) rows.push(toRow(r, 'transferIn'))

  return buildLedger(accounts as unknown as LedgerAccount[], rows, checkpoints as unknown as CheckpointRow[], options.probes)
}

/** Per-account activity for the balance formulas below. */
export async function getAccountActivityMap(
  db: Db,
  userId: string,
  options: ActivityOptions = {},
): Promise<Map<string, AccountActivity>> {
  return (await getAccountLedger(db, userId, options)).activity
}

/**
 * Sign convention (confirmed against the Goals/Savings implementation - a
 * "savings" transaction is a standalone outflow, not linked to any goal or
 * destination account):
 *
 * Asset accounts (debit, savings, time_deposit, cash, e_wallet):
 *   balance = openingBalance + income - expense - savings + transferIn - transferOut + adjustment
 *
 * Credit accounts:
 *   outstanding = openingBalance + expense - income - savings - transferIn + transferOut + adjustment
 *     - openingBalance is the balance owed when the card was added to WaiseKa
 *     - a transfer INTO a card is a payment, so it reduces what you owe
 *     - a transfer OUT of a card (e.g. cash advance) increases what you owe
 *     - an adjustment's delta is already in "amount owed" terms, so it's added as-is
 *   availableCredit = creditLimit - outstanding (null if no creditLimit set)
 */
export function computeAssetBalance(openingBalance: number, activity: AccountActivity | undefined): number {
  if (!activity) return openingBalance
  return openingBalance
    + activity.income
    - activity.expense
    - activity.savings
    + activity.transferIn
    - activity.transferOut
    + (activity.adjustment ?? 0)
}

export function computeOutstanding(openingBalance: number, activity: AccountActivity | undefined): number {
  if (!activity) return openingBalance
  return openingBalance
    + activity.expense
    - activity.income
    - activity.savings
    - activity.transferIn
    + activity.transferOut
    + (activity.adjustment ?? 0)
}

export function computeAvailableCredit(creditLimit: number | null | undefined, outstanding: number): number | null {
  return creditLimit != null ? creditLimit - outstanding : null
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

/**
 * Next occurrence of a credit account's `dueDay` on or after `today` (UTC calendar
 * day). `dueDay` is clamped to the actual month length, same convention as the
 * cutoff-period resolver. Returns null when the account has no `dueDay` set.
 */
export function nextDueDate(account: { dueDay?: number | null }, today: Date): Date | null {
  if (account.dueDay == null) return null

  const year = today.getUTCFullYear()
  const monthIndex0 = today.getUTCMonth()
  const day = today.getUTCDate()

  const thisMonthDue = Math.min(account.dueDay, daysInMonth(year, monthIndex0))
  if (thisMonthDue >= day) {
    return new Date(Date.UTC(year, monthIndex0, thisMonthDue))
  }

  const nextMonthIndex0 = monthIndex0 + 1
  const nextMonthDue = Math.min(account.dueDay, daysInMonth(year, nextMonthIndex0))
  return new Date(Date.UTC(year, nextMonthIndex0, nextMonthDue))
}
