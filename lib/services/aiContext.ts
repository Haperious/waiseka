import type { Db } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'
import { getCurrencySymbol } from '@/lib/currency'
import type { ITransaction } from '@/lib/models/Transaction'
import { sortCurrencies } from '@/lib/services/currencyScope'

/**
 * Per-currency figures for AI prompts (PRD Phase 5). Amounts in different currencies
 * are never added together: every figure the model sees is labelled with its currency.
 */

export interface CurrencySummary {
  currency: CurrencyCode
  income: number
  expenses: number
  /** Top expense categories, largest first. */
  topCategories: { category: string; amount: number }[]
}

/**
 * Income, expenses and top expense categories over [start, end] (end optional), one
 * entry per currency with activity, primary first. Transactions with no currency count
 * as the primary (same rule as currencyScope). The primary is always present, with
 * zeros if it had no activity, so callers can rely on summaries[0] being the primary.
 */
export async function summarizeByCurrency(
  db: Db,
  userId: string,
  primary: CurrencyCode,
  start: Date,
  end?: Date,
  topN = 5,
): Promise<CurrencySummary[]> {
  const rows = await db.collection<ITransaction>('transactions').aggregate<{
    _id: { currency: CurrencyCode; type: string; category: string }
    total: number
  }>([
    {
      $match: {
        userId,
        type: { $in: ['income', 'expense'] },
        date: end ? { $gte: start, $lte: end } : { $gte: start },
      },
    },
    {
      $group: {
        _id: { currency: { $ifNull: ['$currency', primary] }, type: '$type', category: '$category' },
        total: { $sum: '$amount' },
      },
    },
  ]).toArray()

  const byCurrency = new Map<CurrencyCode, CurrencySummary>()
  const get = (currency: CurrencyCode) => {
    let s = byCurrency.get(currency)
    if (!s) {
      s = { currency, income: 0, expenses: 0, topCategories: [] }
      byCurrency.set(currency, s)
    }
    return s
  }
  get(primary)
  for (const { _id, total } of rows) {
    const s = get(_id.currency)
    if (_id.type === 'income') s.income += total
    else {
      s.expenses += total
      s.topCategories.push({ category: _id.category, amount: total })
    }
  }

  return sortCurrencies([...byCurrency.keys()], primary).map((c) => {
    const s = byCurrency.get(c)!
    return { ...s, topCategories: s.topCategories.sort((a, b) => b.amount - a.amount).slice(0, topN) }
  })
}

/**
 * A labelled block for one non-primary currency, appended to a prompt after the
 * primary's figures. `divisor` turns totals into monthly averages (e.g. 3 for 3 months).
 */
export function otherCurrencyBlock(s: CurrencySummary, divisor = 1, periodLabel = 'this month'): string {
  const sym = getCurrencySymbol(s.currency)
  const income = s.income / divisor
  const expenses = s.expenses / divisor
  const suffix = divisor > 1 ? '/month' : ''
  return [
    `Figures in ${s.currency} (${sym}), ${periodLabel}:`,
    `- Income: ${sym}${income.toFixed(2)}${suffix}`,
    `- Expenses: ${sym}${expenses.toFixed(2)}${suffix}`,
    s.topCategories.length
      ? `- Top categories: ${s.topCategories.map((c) => `${c.category} (${sym}${(c.amount / divisor).toFixed(2)}${suffix})`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n')
}

/** Appended to a system prompt whenever more than one currency is present. */
export const MULTI_CURRENCY_RULE =
  'This user has money in more than one currency. Each figure above is labelled with its currency. ' +
  'Never add, compare or convert amounts across currencies, and always state the currency of any amount you mention.'
