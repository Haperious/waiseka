/*
 * Checks for money a request sends. Amounts are stored to the centavo and capped well
 * past any real figure: an amount like 1e300 used to be accepted, and summing two of them
 * gave Infinity, which JSON sends as null and broke every screen showing the total.
 */

/** Largest amount or balance accepted anywhere (one trillion). */
export const MAX_AMOUNT = 1_000_000_000_000

/** Rounds to centavos. Never returns -0, which would show as "-₱0.00". */
export function roundMoney(n: number): number {
  const rounded = Math.round(n * 100) / 100
  return rounded === 0 ? 0 : rounded
}

/** A number in range, rounded to centavos; null for anything else (strings, NaN, Infinity, objects). */
function readMoney(value: unknown, min: number, { allowZero }: { allowZero: boolean }): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (Math.abs(value) > MAX_AMOUNT) return null
  const rounded = roundMoney(value)
  if (rounded < min || (!allowZero && rounded === 0)) return null
  return rounded
}

/** A positive amount (transactions, transfers, limits, targets). 0.004 rounds to 0, so it's refused. */
export const readAmount = (value: unknown) => readMoney(value, 0.01, { allowZero: false })

/** Zero or more (a goal's saved amount, a low-balance threshold). */
export const readNonNegativeAmount = (value: unknown) => readMoney(value, 0, { allowZero: true })

/** Any sign (opening balances, typed bank balances: an overdrawn account is negative). */
export const readBalance = (value: unknown) => readMoney(value, -MAX_AMOUNT, { allowZero: true })
