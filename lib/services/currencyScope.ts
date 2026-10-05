import type { CurrencyCode } from '@/lib/currency'
import type { Db } from 'mongodb'

/**
 * Multi-currency helpers (docs/prd/multi-currency.md).
 *
 * Every aggregation that filters transactions by currency must go through
 * currencyScope() - never write the filter inline. Transactions with no
 * currency (imports, very old rows) count toward the primary currency, which is
 * what keeps single-currency users' numbers identical to before.
 */

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['PHP', 'QAR', 'USD']

export const DEFAULT_CURRENCY: CurrencyCode = 'PHP'

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/** The user's primary currency (preferences.currency), falling back to the app default. */
export function primaryCurrencyOf(user: { preferences?: { currency?: string } } | null | undefined): CurrencyCode {
  const c = user?.preferences?.currency
  return isCurrencyCode(c) ? c : DEFAULT_CURRENCY
}

/**
 * The currency a transaction must carry: its account's currency when it has one,
 * otherwise the user's primary currency. The client-sent currency is never trusted.
 */
export function resolveTransactionCurrency(
  account: { currency?: string } | null | undefined,
  primary: CurrencyCode
): CurrencyCode {
  return isCurrencyCode(account?.currency) ? account.currency : primary
}

/** Mongo filter fragment selecting the transactions that count toward currency `c`. */
export function currencyScope(c: CurrencyCode, primary: CurrencyCode): Record<string, unknown> {
  if (c === primary) {
    return { $or: [{ currency: c }, { currency: null }, { currency: { $exists: false } }] }
  }
  return { currency: c }
}

/** Adds the currency scope to an existing $match without clobbering any $or/$and it already has. */
export function withCurrencyScope<T extends Record<string, unknown>>(
  match: T,
  c: CurrencyCode,
  primary: CurrencyCode
): T & { $and: unknown[] } {
  const existing = Array.isArray(match.$and) ? (match.$and as unknown[]) : []
  return { ...match, $and: [...existing, currencyScope(c, primary)] }
}

/** The `?currency=` a summary endpoint should report in: a supported code, else the primary. */
export function viewCurrencyFrom(searchParams: URLSearchParams, primary: CurrencyCode): CurrencyCode {
  const requested = searchParams.get('currency')
  return isCurrencyCode(requested) ? requested : primary
}

/**
 * Currencies of the user's active (non-archived) accounts, primary first, then
 * alphabetical. Always contains the primary, so a user with no accounts still has one.
 */
export async function getUserCurrencies(db: Db, userId: string, primary: CurrencyCode): Promise<CurrencyCode[]> {
  const codes = await db.collection('accounts').distinct('currency', { userId, isArchived: { $ne: true } })
  return sortCurrencies([primary, ...codes.filter(isCurrencyCode)], primary)
}

/** De-duplicates and orders currency codes: primary first, then alphabetical. */
export function sortCurrencies(codes: CurrencyCode[], primary: CurrencyCode): CurrencyCode[] {
  return [...new Set(codes)].sort((a, b) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)))
}
