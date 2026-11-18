import type { Db, Filter, ObjectId } from 'mongodb'
import type { CurrencyCode } from '@/lib/currency'
import type { IAccount } from '@/lib/models/Account'
import type { IBudget } from '@/lib/models/Budget'
import type { ITransaction } from '@/lib/models/Transaction'
import { roundMoney } from '@/lib/money'
import { addDays, dayInMonth, isDay, monthEnd } from '@/lib/planner/days'
import type {
  PlannerAccount, PlannerBudget, PlannerCard, PlannerContext, PlannerLoggedEntry, PlannerScheduledEntry, PlannerSuggestion,
} from '@/lib/planner/types'
import { computeAssetBalance, computeOutstanding, getAccountLedger, nextDueDate } from './accountBalance'
import { getSpentByCurrencyAndCategory } from './budgetSpending'
import { currencyScope } from './currencyScope'

/** How far back to look for recurring transactions to suggest (a bit over two months). */
const RECURRING_LOOKBACK_DAYS = 62
/** Caps on rows read, so one heavy account can't make the page slow. */
const MAX_SCHEDULED = 500
const MAX_RECENT = 2000
const MAX_SUGGESTION_KEY = 200

const endOfDay = (day: string) => new Date(`${day}T23:59:59.999Z`)
const startOfDay = (day: string) => new Date(`${day}T00:00:00.000Z`)
const utcDayOf = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The day the projection starts. The browser sends its own today so a viewer east of UTC
 * isn't a day behind after midnight; anything more than a day from the server's UTC today
 * is ignored (a wrong clock, or someone poking at the API).
 */
export function resolvePlannerToday(requested: unknown, now: Date = new Date()): string {
  const utcToday = utcDayOf(now)
  if (!isDay(requested)) return utcToday
  return requested >= addDays(utcToday, -1) && requested <= addDays(utcToday, 1) ? requested : utcToday
}

/** An account's currency (accounts saved before multi-currency have none - they're the primary's). */
const accountCurrency = (a: Pick<IAccount, 'currency'>, primary: CurrencyCode) => a.currency ?? primary

/**
 * How a real entry on one account moves that account's part of the starting total.
 * Asset accounts: + balance. Cards: - amount owed (see computeOutstanding).
 */
function deltaFor(isCredit: boolean, kind: 'income' | 'expense' | 'savings' | 'transferIn' | 'transferOut', amount: number): number {
  if (isCredit) {
    // Owed goes up on expense/transferOut, down on everything else
    return kind === 'expense' || kind === 'transferOut' ? -amount : amount
  }
  return kind === 'income' || kind === 'transferIn' ? amount : -amount
}

/**
 * Everything the Planner projection needs for one currency, read fresh each time:
 * account figures as of the end of `today`, entries already logged for later days,
 * this month's budgets, card bills, and recurring transactions not yet logged this month.
 * Reads only - nothing is written.
 */
export async function buildPlannerContext(
  db: Db,
  userId: string,
  primary: CurrencyCode,
  currency: CurrencyCode,
  endDate: string,
  today: string,
): Promise<PlannerContext> {
  const todayEnd = endOfDay(today)
  const horizonEnd = endOfDay(endDate > today ? endDate : today)
  const thisMonthStart = `${today.slice(0, 7)}-01`
  const thisMonthEnd = monthEnd(today)
  const recentFrom = startOfDay(addDays(today, -RECURRING_LOOKBACK_DAYS) < thisMonthStart
    ? addDays(today, -RECURRING_LOOKBACK_DAYS)
    : thisMonthStart)
  // Far enough ahead to see a recurring entry already logged for later this month
  const futureEnd = horizonEnd > endOfDay(thisMonthEnd) ? horizonEnd : endOfDay(thisMonthEnd)

  const allAccounts = await db
    .collection<IAccount>('accounts')
    .find({ userId, isArchived: { $ne: true } })
    .sort({ displayOrder: 1, createdAt: 1 })
    .toArray()
  const accounts = allAccounts.filter((a) => accountCurrency(a, primary) === currency)
  const accountIds: ObjectId[] = accounts.map((a) => a._id)
  const byId = new Map(accounts.map((a) => [a._id.toString(), a]))
  const scope = currencyScope(currency, primary)

  const [ledger, budgets, spentIn, future, recent] = await Promise.all([
    accounts.length > 0
      ? getAccountLedger(db, userId, { asOf: todayEnd })
      : Promise.resolve(null),
    db.collection<IBudget>('budgets').find({ userId, period: 'monthly' }).sort({ createdAt: 1 }).toArray(),
    getSpentByCurrencyAndCategory(db, userId, primary, startOfDay(thisMonthStart), endOfDay(thisMonthEnd)),
    // Entries already logged for after today: on these accounts, plus recurring ones in this currency
    db.collection<ITransaction>('transactions')
      .find({
        userId,
        date: { $gt: todayEnd, $lte: futureEnd },
        type: { $in: ['income', 'expense', 'savings', 'transfer'] },
        $or: [
          { accountId: { $in: accountIds } },
          { fromAccountId: { $in: accountIds } },
          { toAccountId: { $in: accountIds } },
          { isRecurring: true, ...scope },
        ],
      } as Filter<ITransaction>, {
        projection: { type: 1, amount: 1, category: 1, description: 1, date: 1, accountId: 1, fromAccountId: 1, toAccountId: 1, isRecurring: 1, currency: 1 },
      })
      .sort({ date: 1 })
      .limit(MAX_SCHEDULED)
      .toArray(),
    db.collection<ITransaction>('transactions')
      .find({
        userId,
        type: { $in: ['income', 'expense'] },
        date: { $gte: recentFrom, $lte: todayEnd },
        ...scope,
      } as Filter<ITransaction>, { projection: { type: 1, amount: 1, category: 1, description: 1, date: 1, isRecurring: 1 } })
      .sort({ date: -1 })
      .limit(MAX_RECENT)
      .toArray(),
  ])

  // ── Accounts and cards ────────────────────────────────────────────────
  const todayDate = new Date(`${today}T12:00:00.000Z`)
  const plannerAccounts: PlannerAccount[] = []
  const cards: PlannerCard[] = []
  for (const a of accounts) {
    const id = a._id.toString()
    const activity = ledger?.activity.get(id)
    const isCredit = a.type === 'credit'
    const figure = isCredit ? computeOutstanding(a.openingBalance ?? 0, activity) : computeAssetBalance(a.openingBalance ?? 0, activity)
    plannerAccounts.push({ id, name: a.name, type: a.type, figure, includeInTotal: a.includeInTotal !== false })
    if (isCredit) {
      const due = nextDueDate(a, todayDate)
      cards.push({ id, name: a.name, outstanding: figure, dueDate: due ? utcDayOf(due) : null })
    }
  }

  // ── Entries already logged for later days ────────────────────────────
  const scheduled: PlannerScheduledEntry[] = []
  const recurringLoggedThisMonth = new Set<string>()
  for (const t of future) {
    const day = utcDayOf(new Date(t.date))
    if (t.isRecurring && day <= thisMonthEnd && (t.type === 'income' || t.type === 'expense')) {
      recurringLoggedThisMonth.add(recurringKey(t))
    }
    if (day > endDate) continue
    const base = { id: t._id.toString(), day, type: t.type as PlannerScheduledEntry['type'], category: t.category, description: t.description, amount: t.amount }
    if (t.type === 'transfer') {
      const from = t.fromAccountId ? byId.get(t.fromAccountId.toString()) : undefined
      const to = t.toAccountId ? byId.get(t.toAccountId.toString()) : undefined
      if (from) scheduled.push({ ...base, accountId: from._id.toString(), delta: deltaFor(from.type === 'credit', 'transferOut', t.amount) })
      if (to) scheduled.push({ ...base, accountId: to._id.toString(), delta: deltaFor(to.type === 'credit', 'transferIn', t.amount) })
      continue
    }
    const account = t.accountId ? byId.get(t.accountId.toString()) : undefined
    if (!account) continue
    scheduled.push({ ...base, accountId: account._id.toString(), delta: deltaFor(account.type === 'credit', t.type as 'income' | 'expense' | 'savings', t.amount) })
  }

  // ── Budgets ───────────────────────────────────────────────────────────
  const plannerBudgets: PlannerBudget[] = budgets
    .filter((b) => (b.currency ?? primary) === currency)
    .map((b) => {
      const spent = roundMoney(spentIn(currency, b.category))
      return { id: b._id.toString(), category: b.category, limit: b.limit, spent, remaining: roundMoney(Math.max(0, b.limit - spent)) }
    })

  // ── Logged this month, and recurring suggestions ──────────────────────
  const logged: PlannerLoggedEntry[] = []
  const latestRecurring = new Map<string, ITransaction>()
  for (const t of recent) {
    const day = utcDayOf(new Date(t.date))
    if (day >= thisMonthStart) logged.push({ type: t.type, category: t.category, amount: t.amount, day })
    if (!t.isRecurring) continue
    const key = recurringKey(t)
    // Sorted newest first, so the first one seen is the latest
    if (!latestRecurring.has(key)) latestRecurring.set(key, t)
  }

  const suggestions: PlannerSuggestion[] = []
  for (const [key, t] of latestRecurring) {
    const lastDay = utcDayOf(new Date(t.date))
    if (lastDay >= thisMonthStart || recurringLoggedThisMonth.has(key)) continue
    // Same day of the month as last time; if that's already passed, it's due now
    let date = dayInMonth(today, Number(lastDay.slice(8, 10)))
    if (date < today) date = today
    if (date > endDate) continue
    suggestions.push({
      key,
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      category: t.category,
      note: t.description?.trim() || undefined,
      date,
    })
  }
  suggestions.sort((a, b) => a.date.localeCompare(b.date))

  return { today, accounts: plannerAccounts, scheduled, budgets: plannerBudgets, cards, suggestions, logged }
}

/** Groups repeats of one recurring entry: same type, category and description. */
function recurringKey(t: Pick<ITransaction, 'type' | 'category' | 'description'>): string {
  return `rec:${t.type}:${t.category.trim().toLowerCase()}:${(t.description ?? '').trim().toLowerCase()}`.slice(0, MAX_SUGGESTION_KEY)
}
