/**
 * "Why doesn't WaiseKa match my bank?" Before an adjustment is saved, these hints point at
 * the usual causes so the user can fix the history instead of papering over it:
 *
 *  - unlinked: entries with no account never move a balance. One linked here could close the gap.
 *  - duplicate: the same entry saved twice. Removing the extra copy could close the gap.
 *  - wrongType: income saved as an expense (or the reverse) is off by twice the amount.
 *  - beforeOpening: entries before the opening date are skipped, in case the opening
 *    balance didn't really include them.
 *
 * `delta` is bank minus WaiseKa in the account's own terms (balance, or amount owed for cards).
 * Each entry's "effect" is how it moves that figure, so the matching works for cards too.
 */

export type HintEntryType = 'income' | 'expense' | 'savings' | 'transfer'

export interface HintEntry {
  _id: string
  type: HintEntryType
  amount: number
  /** yyyy-MM-dd (UTC) */
  day: string
  description?: string
  category?: string
  /** Transfers only: true when money left this account. */
  outgoing?: boolean
}

export interface HintItem {
  entry: HintEntry
  /** Fixing this one entry closes the gap exactly. */
  exact: boolean
}

export interface GapHints {
  unlinked: { count: number; items: HintItem[] }
  duplicates: { items: HintItem[] }
  wrongType: { items: HintItem[] }
  beforeOpening: { count: number; exact: boolean }
}

const MAX_ITEMS = 5
const round2 = (n: number) => Math.round(n * 100) / 100
const same = (a: number, b: number) => Math.abs(a - b) < 0.005

/**
 * How an entry moves the account's figure if it's on this account. Mirrors
 * computeAssetBalance / computeOutstanding in accountBalance.ts.
 */
export function entryEffect(entry: HintEntry, isCredit: boolean): number {
  const transferIn = entry.type === 'transfer' && !entry.outgoing
  const transferOut = entry.type === 'transfer' && !!entry.outgoing
  const up = isCredit
    ? entry.type === 'expense' || transferOut
    : entry.type === 'income' || transferIn
  return (up ? 1 : -1) * entry.amount
}

const dayGap = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000

/** Exact matches first, then most recent. */
function rank(items: HintItem[]): HintItem[] {
  return [...items]
    .sort((a, b) => Number(b.exact) - Number(a.exact) || (a.entry.day < b.entry.day ? 1 : -1))
    .slice(0, MAX_ITEMS)
}

export function buildGapHints({ delta, isCredit, accountEntries, unlinkedEntries, beforeOpeningEntries }: {
  delta: number
  isCredit: boolean
  /** This account's entries since its last checkpoint, up to the adjustment date. */
  accountEntries: HintEntry[]
  /** Unlinked entries in the account's currency over the same period. */
  unlinkedEntries: HintEntry[]
  /** This account's entries dated before its opening balance date. */
  beforeOpeningEntries: HintEntry[]
}): GapHints {
  // Linking an unlinked entry here adds its effect: it fits when that equals the gap
  const unlinked = unlinkedEntries.map((entry) => ({ entry, exact: same(entryEffect(entry, isCredit), delta) }))

  // Same type, amount and direction within a day of each other. The later copy is the
  // suspect; removing it takes its effect away, so it fits when -effect equals the gap.
  const duplicates: HintItem[] = []
  const sorted = [...accountEntries].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  const flagged = new Set<string>()
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && dayGap(sorted[i].day, sorted[j].day) <= 1; j++) {
      const a = sorted[i], b = sorted[j]
      if (flagged.has(b._id) || a.type !== b.type || !same(a.amount, b.amount) || !!a.outgoing !== !!b.outgoing) continue
      flagged.add(b._id)
      duplicates.push({ entry: b, exact: same(-entryEffect(b, isCredit), delta) })
    }
  }

  // Swapping income <-> expense flips its effect, a change of -2x the effect
  const wrongType = accountEntries
    .filter((e) => e.type === 'income' || e.type === 'expense')
    .filter((e) => same(-2 * entryEffect(e, isCredit), delta))
    .map((entry) => ({ entry, exact: true }))

  const beforeTotal = round2(beforeOpeningEntries.reduce((sum, e) => sum + entryEffect(e, isCredit), 0))

  return {
    unlinked: { count: unlinked.length, items: rank(unlinked.filter((h) => h.exact)) },
    // Inexact duplicates are still worth a look; exact ones lead
    duplicates: { items: rank(duplicates) },
    wrongType: { items: rank(wrongType) },
    beforeOpening: { count: beforeOpeningEntries.length, exact: beforeOpeningEntries.length > 0 && same(beforeTotal, delta) },
  }
}
