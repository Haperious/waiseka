/*
 * GET /api/insights/today
 *
 * Ranked feed backing the dashboard's "Needs you today" row. Composed from three
 * independent sources that already exist in different shapes elsewhere in the app -
 * this route is purely an aggregator, it writes nothing.
 *
 * Multi-currency: the feed covers every currency at once (an item is relevant whatever
 * the view currency), but each item is computed and formatted in its own currency -
 * budgets in their own currency (missing = primary), credit cards and planned
 * transfers in their account's currency, with that currency's cutoff period.
 */

import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { resolveCutoffPeriod, cutoffPrefsFor } from '@/lib/services/cutoff'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'
import { getSpentByCurrencyAndCategory } from '@/lib/services/budgetSpending'
import { getAccountLedger, computeAssetBalance, computeOutstanding, nextDueDate } from '@/lib/services/accountBalance'
import { verificationProbes, verificationStatus, verifiedDaysAgo } from '@/lib/services/verification'
import { formatAmount } from '@/lib/currency'
import type { IBudget } from '@/lib/models/Budget'
import type { IAccount } from '@/lib/models/Account'
import type { IPlannedTransfer } from '@/lib/models/PlannedTransfer'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'

const CREDIT_DUE_WITHIN_DAYS = 5
const BUDGET_NEAR_LIMIT_PCT = 90

export interface InsightItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  icon: 'TrendingDown' | 'CreditCard' | 'PiggyBank' | 'ShieldCheck'
  title: string
  body: string
  href: string
}

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const userId = session.user.id
  const now = new Date()

  const [user, budgets, accounts, plannedTransfers] = await Promise.all([
    db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } }),
    db.collection<IBudget>('budgets').find({ userId }).toArray(),
    db.collection<IAccount>('accounts').find({ userId, isArchived: { $ne: true } }).toArray(),
    db.collection<IPlannedTransfer>('plannedTransfers').find({ userId, active: true }).toArray(),
  ])

  const items: InsightItem[] = []
  const primary = primaryCurrencyOf(user)

  // ── Budget breach / near-limit ──────────────────────────────────────────
  if (budgets.length > 0) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const spentIn = await getSpentByCurrencyAndCategory(db, userId, primary, monthStart, monthEnd)

    for (const budget of budgets) {
      if (budget.period !== 'monthly') continue // weekly budgets are noisy for a daily digest
      const currency = budget.currency ?? primary
      const spent = spentIn(currency, budget.category)
      const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0
      if (pct < BUDGET_NEAR_LIMIT_PCT) continue

      const over = spent - budget.limit
      items.push({
        id: `budget-${budget._id.toString()}`,
        severity: pct >= 100 ? 'critical' : 'warning',
        icon: 'TrendingDown',
        title: pct >= 100 ? `${budget.category} is over` : `${budget.category} is close to its limit`,
        body:
          pct >= 100
            ? `${formatAmount(spent, currency)} spent on a ${formatAmount(budget.limit, currency)} ceiling - ${formatAmount(over, currency)} over.`
            : `${formatAmount(spent, currency)} of ${formatAmount(budget.limit, currency)} spent this month.`,
        href: '/budgets',
      })
    }
  }

  // One ledger for both the card and the balance-check items below
  const { activity: activityMap, probeFigures } = accounts.length > 0
    ? await getAccountLedger(db, userId, { probes: verificationProbes(accounts) })
    : { activity: new Map(), probeFigures: new Map<string, number>() }

  // ── Credit card due soon ────────────────────────────────────────────────
  const creditAccounts = accounts.filter((a) => a.type === 'credit' && a.dueDay != null)
  if (creditAccounts.length > 0) {
    for (const account of creditAccounts) {
      const due = nextDueDate(account, now)
      if (!due) continue
      const daysUntilDue = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue < 0 || daysUntilDue > CREDIT_DUE_WITHIN_DAYS) continue

      const outstanding = computeOutstanding(account.openingBalance ?? 0, activityMap.get(account._id.toString()))
      if (outstanding <= 0) continue

      items.push({
        id: `credit-due-${account._id.toString()}`,
        severity: daysUntilDue <= 1 ? 'critical' : 'warning',
        icon: 'CreditCard',
        title:
          daysUntilDue === 0
            ? `${account.name} due today`
            : `${account.name} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        body: `${formatAmount(outstanding, account.currency)} outstanding.`,
        href: '/accounts',
      })
    }
  }

  // ── Pending planned transfers ────────────────────────────────────────────
  if (plannedTransfers.length > 0) {
    // Each planned transfer runs on its source account's currency and that currency's cutoff
    const currencyByAccount = new Map(accounts.map((a) => [a._id.toString(), a.currency]))
    const planned = plannedTransfers.map((p) => {
      const currency = currencyByAccount.get(p.fromAccountId.toString()) ?? primary
      return { p, currency, period: resolveCutoffPeriod(cutoffPrefsFor(user?.preferences, currency), now) }
    })
    const earliest = new Date(Math.min(...planned.map((x) => x.period.start.getTime())))
    const latest = new Date(Math.max(...planned.map((x) => x.period.end.getTime())))
    const movedTransfers = await db.collection<ITransaction>('transactions').find({
      userId,
      type: 'transfer',
      date: { $gte: earliest, $lte: latest },
    }).toArray()

    for (const { p, currency, period } of planned) {
      const moved = movedTransfers.some((t) =>
        t.fromAccountId?.toString() === p.fromAccountId.toString() &&
        t.toAccountId?.toString() === p.toAccountId.toString() &&
        t.date >= period.start && t.date <= period.end
      )
      if (moved) continue

      items.push({
        id: `planned-transfer-${p._id.toString()}`,
        severity: 'info',
        icon: 'PiggyBank',
        title: `${formatAmount(p.amount, currency)} not yet moved`,
        body: `Expected this cutoff (${period.label}). Your transfer is still pending.`,
        href: '/accounts',
      })
    }
  }

  // ── Balance check due ───────────────────────────────────────────────────
  // Catching a gap with the bank early (a missed entry, a fee) is far easier than weeks later
  const due = accounts
    .map((account) => ({ account, status: verificationStatus(account, probeFigures.get(account._id.toString()), now) }))
    .filter((x) => x.status !== 'fresh')
  if (due.length === 1) {
    const { account, status } = due[0]
    const isCredit = account.type === 'credit'
    const activity = activityMap.get(account._id.toString())
    const figure = isCredit
      ? computeOutstanding(account.openingBalance ?? 0, activity)
      : computeAssetBalance(account.openingBalance ?? 0, activity)
    const amount = formatAmount(figure, account.currency)
    const days = verifiedDaysAgo(account, now) ?? 0
    const question = isCredit
      ? `Does your card still show ${amount} owed?`
      : `Does your bank still show ${amount}?`
    items.push({
      id: `verify-${account._id.toString()}`,
      severity: status === 'changed' ? 'warning' : 'info',
      icon: 'ShieldCheck',
      title: status === 'changed' ? `${account.name} changed since your last check` : `Check ${account.name}'s balance`,
      body:
        status === 'changed' ? `An older entry was added or edited after you checked. ${question}`
        : status === 'never' ? `You haven't checked it against your bank yet. ${question}`
        : `Last checked ${days} day${days === 1 ? '' : 's'} ago. ${question}`,
      href: `/accounts?verify=${account._id.toString()}`,
    })
  } else if (due.length > 1) {
    const changed = due.filter((x) => x.status === 'changed').length
    items.push({
      id: 'verify-many',
      severity: changed > 0 ? 'warning' : 'info',
      icon: 'ShieldCheck',
      title: `${due.length} accounts are due for a balance check`,
      body: changed > 0
        ? `${changed} changed after your last check. It takes a few seconds and catches missed entries early.`
        : 'It takes a few seconds and catches missed entries early.',
      href: '/accounts',
    })
  }

  const severityRank = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return NextResponse.json(items)
}
