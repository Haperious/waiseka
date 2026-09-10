/*
 * GET /api/insights/today
 *
 * Ranked feed backing the dashboard's "Needs you today" row. Composed from three
 * independent sources that already exist in different shapes elsewhere in the app -
 * this route is purely an aggregator, it writes nothing.
 */

import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { resolveCutoffPeriod } from '@/lib/services/cutoff'
import { getAccountActivityMap, computeOutstanding, nextDueDate } from '@/lib/services/accountBalance'
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
  icon: 'TrendingDown' | 'CreditCard' | 'PiggyBank'
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

  // ── Budget breach / near-limit ──────────────────────────────────────────
  if (budgets.length > 0) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const spentRows = await db.collection<ITransaction>('transactions').aggregate<{ category: string; total: number }>([
      { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $project: { _id: 0, category: '$_id', total: 1 } },
    ]).toArray()
    const spentMap = new Map(spentRows.map((r) => [r.category, r.total]))

    for (const budget of budgets) {
      if (budget.period !== 'monthly') continue // weekly budgets are noisy for a daily digest
      const spent = spentMap.get(budget.category) ?? 0
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
            ? `₱${Math.round(spent).toLocaleString()} spent on a ₱${Math.round(budget.limit).toLocaleString()} ceiling - ₱${Math.round(over).toLocaleString()} over.`
            : `₱${Math.round(spent).toLocaleString()} of ₱${Math.round(budget.limit).toLocaleString()} spent this month.`,
        href: '/budgets',
      })
    }
  }

  // ── Credit card due soon ────────────────────────────────────────────────
  const creditAccounts = accounts.filter((a) => a.type === 'credit' && a.dueDay != null)
  if (creditAccounts.length > 0) {
    const activityMap = await getAccountActivityMap(db, userId)
    for (const account of creditAccounts) {
      const due = nextDueDate(account, now)
      if (!due) continue
      const daysUntilDue = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue < 0 || daysUntilDue > CREDIT_DUE_WITHIN_DAYS) continue

      const outstanding = computeOutstanding(activityMap.get(account._id.toString()))
      if (outstanding <= 0) continue

      items.push({
        id: `credit-due-${account._id.toString()}`,
        severity: daysUntilDue <= 1 ? 'critical' : 'warning',
        icon: 'CreditCard',
        title:
          daysUntilDue === 0
            ? `${account.name} due today`
            : `${account.name} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        body: `₱${Math.round(outstanding).toLocaleString()} outstanding.`,
        href: '/accounts',
      })
    }
  }

  // ── Pending planned transfers ────────────────────────────────────────────
  if (plannedTransfers.length > 0) {
    const period = resolveCutoffPeriod(user?.preferences ?? {}, now)
    const movedTransfers = await db.collection<ITransaction>('transactions').find({
      userId,
      type: 'transfer',
      date: { $gte: period.start, $lte: period.end },
    }).toArray()
    const movedPairs = new Set(
      movedTransfers.map((t) => `${t.fromAccountId?.toString()}:${t.toAccountId?.toString()}`)
    )

    for (const planned of plannedTransfers) {
      const moved = movedPairs.has(`${planned.fromAccountId}:${planned.toAccountId}`)
      if (moved) continue

      items.push({
        id: `planned-transfer-${planned._id.toString()}`,
        severity: 'info',
        icon: 'PiggyBank',
        title: `₱${Math.round(planned.amount).toLocaleString()} not yet moved`,
        body: `Expected this cutoff (${period.label}). Your transfer is still pending.`,
        href: '/accounts',
      })
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return NextResponse.json(items)
}
