import cron from 'node-cron'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { sendPushNotification } from '@/lib/notifications'
import {
  sendBudgetReminderEmail,
  sendReEngageEmail,
  sendMonthlyReportEmail,
} from '@/lib/email'
import type { IUser } from '@/lib/models/User'
import type { IBudget } from '@/lib/models/Budget'
import type { IGoal } from '@/lib/models/Goal'
import type { ITransaction } from '@/lib/models/Transaction'
import { logEmail } from '@/lib/models/EmailLog'
import { MONTH_NAMES } from '@/lib/constants'
import { formatCurrency as fmt } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_THRESHOLD: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 }

type CategoryTotal = { _id: string; total: number; count?: number }

function toTotalMap(rows: CategoryTotal[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r._id, r.total]))
}

// ─── AI Query Reset (daily midnight) ─────────────────────────────────────────

export async function resetAiQueries() {
  try {
    const db = await getDb()
    const now = new Date()
    // Every due user resets to the 1st of next month (same convention as registration).
    // Computed from `now` rather than each user's old resetDate, so a missed run can't
    // leave a user with a resetDate that's still in the past.
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    await db.collection<IUser>('users').updateMany(
      { 'ai.resetDate': { $lte: now } },
      { $set: { 'ai.queriesUsed': 0, 'ai.resetDate': nextReset, updatedAt: now } }
    )
  } catch (err) {
    console.error('[scheduler] AI reset error:', err)
  }
}

// ─── Budget Reminder (15th of each month at 9 AM) ────────────────────────────

export async function sendBudgetReminders() {
  try {
    const db = await getDb()
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const daysInMonth = monthEnd.getUTCDate()
    const daysRemaining = daysInMonth - now.getUTCDate()
    const monthName = MONTH_NAMES[now.getUTCMonth()]

    const users = await db.collection<IUser>('users')
      .find({ 'notifications.email.enabled': true }, { projection: { name: 1, email: 1, preferences: 1, notifications: 1 } })
      .toArray()

    for (const user of users) {
      const frequency = user.notifications?.email?.frequency ?? 'weekly'
      const lastSent = user.notifications?.email?.lastSentBudget
        ? new Date(user.notifications.email.lastSentBudget).getTime() : 0
      const daysSinceEmail = (Date.now() - lastSent) / (1000 * 60 * 60 * 24)
      if (daysSinceEmail < (EMAIL_THRESHOLD[frequency] ?? 7)) continue

      const userId = user._id.toString()
      const sym = user.preferences?.currencySymbol ?? '₱'

      const budgets = await db.collection<IBudget>('budgets').find({ userId }).toArray()
      if (budgets.length === 0) continue

      const [agg] = await db.collection<ITransaction>('transactions').aggregate<{
        spent: CategoryTotal[]
        income: { total: number }[]
      }>([
        { $match: { userId, type: { $in: ['income', 'expense'] }, date: { $gte: monthStart, $lte: monthEnd } } },
        {
          $facet: {
            spent: [
              { $match: { type: 'expense' } },
              { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ],
            income: [
              { $match: { type: 'income' } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ],
          },
        },
      ]).toArray()

      const spentMap = toTotalMap(agg?.spent ?? [])
      const totalIncome = agg?.income[0]?.total ?? 0
      const totalSpent = Object.values(spentMap).reduce((a, b) => a + b, 0)
      const totalLimit = budgets.reduce((a, b) => a + b.limit, 0)
      const usedPercent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0

      const categories = budgets.map((b) => {
        const spent = spentMap[b.category] ?? 0
        const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0
        return { name: b.category, usedPercent: pct, spent: fmt(spent, sym), limit: fmt(b.limit, sym) }
      }).sort((a, b) => b.usedPercent - a.usedPercent)

      // Worst category for the alert block
      const worst = categories[0]
      const projectedSpent = totalLimit > 0 ? (totalSpent / (daysInMonth - daysRemaining)) * daysInMonth : 0
      const alertCategory = worst?.usedPercent >= 75 ? worst.name : undefined
      const projectedOverage = alertCategory && projectedSpent > totalLimit
        ? fmt(projectedSpent - totalLimit, sym)
        : undefined

      await db.collection<IUser>('users').updateOne(
        { _id: user._id },
        { $set: { 'notifications.email.lastSentBudget': new Date() } }
      )

      sendBudgetReminderEmail({
        firstName: user.name.split(' ')[0],
        email: user.email,
        monthName,
        daysRemaining,
        usedPercent,
        totalIncome: fmt(totalIncome, sym),
        totalSpent: fmt(totalSpent, sym),
        totalRemaining: fmt(Math.max(0, totalIncome - totalSpent), sym),
        categories,
        alertCategory,
        projectedOverage,
      })
        .then(() => logEmail(db, { userId, type: 'budget_reminder' }))
        .catch((err) => console.error(`[scheduler] budget reminder error for user ${userId}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] budget reminder job error:', err)
  }
}

// ─── Re-Engage (daily at 10 AM, targets users inactive 14+ days) ─────────────

export async function sendReEngageEmails() {
  try {
    const db = await getDb()
    const now = new Date()
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate()
    const monthName = MONTH_NAMES[now.getUTCMonth()]

    const users = await db.collection<IUser>('users')
      .find({
        'notifications.email.enabled': true,
        'notifications.lastSeen': { $lt: cutoff },
      }, { projection: { name: 1, email: 1, preferences: 1, notifications: 1 } })
      .toArray()

    for (const user of users) {
      const frequency = user.notifications?.email?.frequency ?? 'weekly'
      const lastSent = user.notifications?.email?.lastSentReEngage
        ? new Date(user.notifications.email.lastSentReEngage).getTime() : 0
      const daysSinceEmail = (Date.now() - lastSent) / (1000 * 60 * 60 * 24)
      if (daysSinceEmail < (EMAIL_THRESHOLD[frequency] ?? 7)) continue

      const userId = user._id.toString()
      const sym = user.preferences?.currencySymbol ?? '₱'
      const daysSinceLogin = Math.floor(
        (now.getTime() - new Date(user.notifications.lastSeen).getTime()) / (1000 * 60 * 60 * 24)
      )

      const topGoal = await db.collection<IGoal>('goals')
        .find({ userId, status: 'active' })
        .sort({ savedAmount: -1 })
        .limit(1)
        .next()

      if (!topGoal) continue

      const goalPercent = topGoal.targetAmount > 0
        ? Math.round((topGoal.savedAmount / topGoal.targetAmount) * 100)
        : 0

      await db.collection<IUser>('users').updateOne(
        { _id: user._id },
        { $set: { 'notifications.email.lastSentReEngage': new Date() } }
      )

      sendReEngageEmail({
        firstName: user.name.split(' ')[0],
        email: user.email,
        daysSinceLogin,
        monthName,
        daysRemaining,
        topGoalName: topGoal.title,
        topGoalPercent: goalPercent,
        topGoalTarget: fmt(topGoal.targetAmount, sym),
      })
        .then(() => logEmail(db, { userId, type: 're_engage' }))
        .catch((err) => console.error(`[scheduler] re-engage error for user ${userId}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] re-engage job error:', err)
  }
}

// ─── Monthly Report (1st of each month at 8 AM) ───────────────────────────────

export async function sendMonthlyReports() {
  try {
    const db = await getDb()
    const now = new Date()
    const prevMonth = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1
    const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    const monthStart = new Date(Date.UTC(prevYear, prevMonth, 1))
    const monthEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999))
    // The month before the reported one, for the insight comparison
    const compareStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1))
    const monthName = MONTH_NAMES[prevMonth]
    const nextMonthName = MONTH_NAMES[now.getUTCMonth()]

    const DOT_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e']

    const users = await db.collection<IUser>('users')
      .find({ 'notifications.email.enabled': true }, { projection: { name: 1, email: 1, preferences: 1 } })
      .toArray()

    for (const user of users) {
      const userId = user._id.toString()
      const sym = user.preferences?.currencySymbol ?? '₱'

      // One aggregation over both months: totals and categories for the reported month,
      // categories for the month before it.
      const [agg] = await db.collection<ITransaction>('transactions').aggregate<{
        totals: CategoryTotal[]
        categories: Required<CategoryTotal>[]
        prevCategories: CategoryTotal[]
      }>([
        { $match: { userId, type: { $in: ['income', 'expense'] }, date: { $gte: compareStart, $lte: monthEnd } } },
        {
          $facet: {
            totals: [
              { $match: { date: { $gte: monthStart } } },
              { $group: { _id: '$type', total: { $sum: '$amount' } } },
            ],
            categories: [
              { $match: { type: 'expense', date: { $gte: monthStart } } },
              { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
              { $sort: { total: -1 } },
            ],
            prevCategories: [
              { $match: { type: 'expense', date: { $lt: monthStart } } },
              { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ],
          },
        },
      ]).toArray()

      const totals = toTotalMap(agg?.totals ?? [])
      const totalIncome = totals.income ?? 0
      const totalSpent = totals.expense ?? 0
      const totalSaved = Math.max(0, totalIncome - totalSpent)

      if (totalIncome === 0 && totalSpent === 0) continue // Skip users with no activity

      const budgets = await db.collection<IBudget>('budgets').find({ userId }).toArray()
      const categories = agg?.categories ?? []
      const topCategories = categories.slice(0, 5)
      // Use every category here, not just the top 5 - otherwise an over-budget category
      // outside the top 5 would be counted as on budget.
      const spentMap = toTotalMap(categories)
      const categoriesOnBudget = budgets.filter((b) => (spentMap[b.category] ?? 0) <= b.limit).length

      // Build insight: compare top category vs previous month
      const topCat = topCategories[0]
      const prevSpentMap = toTotalMap(agg?.prevCategories ?? [])
      const prevTopSpent = topCat ? (prevSpentMap[topCat._id] ?? 0) : 0
      const currTopSpent = topCat?.total ?? 0
      const changePercent = prevTopSpent > 0
        ? Math.abs(Math.round(((currTopSpent - prevTopSpent) / prevTopSpent) * 100))
        : 0
      const changeDirection = currTopSpent <= prevTopSpent ? 'dropped' : 'increased'
      const prevMonthName = MONTH_NAMES[prevMonth === 0 ? 11 : prevMonth - 1]
      const monthlySavingsFree = changeDirection === 'dropped' && changePercent > 0
        ? fmt(currTopSpent * (changePercent / 100), sym)
        : fmt(0, sym)

      await db.collection<IUser>('users').updateOne(
        { _id: user._id },
        { $set: { 'notifications.email.lastSentMonthly': new Date() } }
      )

      sendMonthlyReportEmail({
        firstName: user.name.split(' ')[0],
        email: user.email,
        monthName,
        year: String(prevYear),
        nextMonthName,
        totalIncome: fmt(totalIncome, sym),
        totalSpent: fmt(totalSpent, sym),
        totalSaved: fmt(totalSaved, sym),
        categoriesOnBudget,
        totalCategories: budgets.length,
        topCategories: topCategories.map((c, i) => ({
          name: c._id,
          txnCount: c.count,
          totalSpent: fmt(c.total, sym),
          dotColor: DOT_COLORS[i % DOT_COLORS.length],
        })),
        insight: {
          comparedCategory: topCat?._id ?? 'spending',
          changePercent,
          changeDirection,
          comparedMonth: prevMonthName,
          monthlySavingsFree,
        },
      })
        .then(() => logEmail(db, { userId, type: 'monthly_report' }))
        .catch((err) => console.error(`[scheduler] monthly report error for user ${userId}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] monthly report job error:', err)
  }
}

// ─── Push Notifications (daily at 9 AM) ──────────────────────────────────────

export async function sendPushNotifications() {
  try {
    const settings = await getSettings()
    if (!settings.notificationsEnabled) return

    const db = await getDb()
    const users = await db.collection<IUser>('users')
      .find({ 'notifications.push.enabled': true }, { projection: { email: 1, notifications: 1 } })
      .toArray()

    const now = Date.now()

    for (const user of users) {
      const lastSeen = user.notifications?.lastSeen
        ? new Date(user.notifications.lastSeen).getTime() : 0
      const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24)
      const threshold = EMAIL_THRESHOLD[user.notifications?.push?.frequency ?? 'weekly'] ?? 7
      if (daysSince < threshold) continue

      const type = daysSince >= threshold * 2 ? 'inactivity' : 'reminder'
      if (user.notifications?.push?.fcmToken) {
        sendPushNotification({ fcmToken: user.notifications.push.fcmToken, type, user }).catch((err) =>
          console.error(`[scheduler] push error for user ${user._id.toString()}:`, err)
        )
      }
    }
  } catch (err) {
    console.error('[scheduler] push notification error:', err)
  }
}

// ─── Account alerts (daily 8 AM) - low balance & credit utilization ──────────

export async function runAccountAlertsJob() {
  try {
    const db = await getDb()
    const { runAccountAlerts } = await import('@/lib/services/accountAlerts')
    await runAccountAlerts(db)
  } catch (err) {
    console.error('[scheduler] account alerts error:', err)
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

/**
 * In-process node-cron scheduling. This only works on a persistent Node host and
 * does NOT fire on Netlify's serverless functions - in production, scheduling is
 * handled by a Netlify Scheduled Function that calls /api/cron (see netlify/functions
 * and app/api/cron). Kept for local dev, where node-cron works fine.
 *
 * Set DISABLE_INPROCESS_CRON=true (do this in the Netlify environment) to skip this
 * entirely so the two mechanisms can never both fire.
 */
export function startSchedulers() {
  if (process.env.DISABLE_INPROCESS_CRON === 'true') return

  cron.schedule('0 0 * * *', resetAiQueries)           // midnight daily
  cron.schedule('0 8 1 * *', sendMonthlyReports)        // 8 AM on 1st
  cron.schedule('0 9 15 * *', sendBudgetReminders)      // 9 AM on 15th
  cron.schedule('0 10 * * *', sendReEngageEmails)       // 10 AM daily
  cron.schedule('0 9 * * *', sendPushNotifications)     // 9 AM daily
  cron.schedule('0 8 * * *', runAccountAlertsJob)       // 8 AM daily
}
