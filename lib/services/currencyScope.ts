import type { CurrencyCode } from '@/lib/currency'

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
