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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, sym: string) {
  return `${sym}${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const EMAIL_THRESHOLD: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 }

// ─── AI Query Reset (daily midnight) ─────────────────────────────────────────

async function resetAiQueries() {
  try {
    const db = await getDb()
    const users = db.collection<IUser>('users')
    const now = new Date()
    const toReset = await users.find({ 'ai.resetDate': { $lte: now } }).toArray()

    for (const user of toReset) {
      const nextReset = new Date(user.ai.resetDate)
      nextReset.setMonth(nextReset.getMonth() + 1)
      nextReset.setDate(1)
      nextReset.setHours(0, 0, 0, 0)
      await users.updateOne(
        { _id: user._id },
        { $set: { 'ai.queriesUsed': 0, 'ai.resetDate': nextReset, updatedAt: new Date() } }
      )
    }
  } catch (err) {
    console.error('[scheduler] AI reset error:', err)
  }
}

// ─── Budget Reminder (15th of each month at 9 AM) ────────────────────────────

async function sendBudgetReminders() {
  try {
    const db = await getDb()
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const daysInMonth = monthEnd.getUTCDate()
    const daysRemaining = daysInMonth - now.getUTCDate()
    const monthName = MONTH_NAMES[now.getMonth()]

    const users = await db.collection<IUser>('users')
      .find({ 'notifications.email.enabled': true }, { projection: { name: 1, email: 1, preferences: 1, notifications: 1 } })
      .toArray()

    for (const user of users) {
      const frequency = user.notifications?.email?.frequency ?? 'weekly'
      const lastSent = user.notifications?.email?.lastSent
        ? new Date(user.notifications.email.lastSent).getTime() : 0
      const daysSinceEmail = (Date.now() - lastSent) / (1000 * 60 * 60 * 24)
      if (daysSinceEmail < (EMAIL_THRESHOLD[frequency] ?? 7)) continue

      const userId = user._id.toString()
      const sym = user.preferences?.currencySymbol ?? '₱'

      const [budgets, spentAgg, incomeAgg] = await Promise.all([
        db.collection<IBudget>('budgets').find({ userId }).toArray(),
        db.collection<ITransaction>('transactions').aggregate([
          { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: '$category', total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection<ITransaction>('transactions').aggregate([
          { $match: { userId, type: 'income', date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).toArray(),
      ])

      if (budgets.length === 0) continue

      const spentMap = Object.fromEntries(spentAgg.map((r) => [(r as { _id: string; total: number })._id, (r as { _id: string; total: number }).total]))
      const totalIncome = incomeAgg[0]?.total ?? 0
      const totalSpent = Object.values(spentMap).reduce((a, b) => a + (b as number), 0) as number
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
        { $set: { 'notifications.email.lastSent': new Date() } }
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
      }).catch((err) => console.error(`[scheduler] budget reminder error for ${user.email}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] budget reminder job error:', err)
  }
}

// ─── Re-Engage (daily at 10 AM, targets users inactive 14+ days) ─────────────

async function sendReEngageEmails() {
  try {
    const db = await getDb()
    const now = new Date()
    const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate()
    const monthName = MONTH_NAMES[now.getMonth()]

    const users = await db.collection<IUser>('users')
      .find({
        'notifications.email.enabled': true,
        'notifications.lastSeen': { $lt: cutoff },
      }, { projection: { name: 1, email: 1, preferences: 1, notifications: 1 } })
      .toArray()

    for (const user of users) {
      const frequency = user.notifications?.email?.frequency ?? 'weekly'
      const lastSent = user.notifications?.email?.lastSent
        ? new Date(user.notifications.email.lastSent).getTime() : 0
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
        { $set: { 'notifications.email.lastSent': new Date() } }
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
      }).catch((err) => console.error(`[scheduler] re-engage error for ${user.email}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] re-engage job error:', err)
  }
}

// ─── Monthly Report (1st of each month at 8 AM) ───────────────────────────────

async function sendMonthlyReports() {
  try {
    const db = await getDb()
    const now = new Date()
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const monthStart = new Date(Date.UTC(prevYear, prevMonth, 1))
    const monthEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999))
    const monthName = MONTH_NAMES[prevMonth]
    const nextMonthName = MONTH_NAMES[now.getMonth()]

    const DOT_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e']

    const users = await db.collection<IUser>('users')
      .find({ 'notifications.email.enabled': true }, { projection: { name: 1, email: 1, preferences: 1 } })
      .toArray()

    for (const user of users) {
      const userId = user._id.toString()
      const sym = user.preferences?.currencySymbol ?? '₱'

      const [incomeAgg, expenseAgg, categoryAgg, prevMonthAgg, budgets] = await Promise.all([
        db.collection<ITransaction>('transactions').aggregate([
          { $match: { userId, type: 'income', date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection<ITransaction>('transactions').aggregate([
          { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection<ITransaction>('transactions').aggregate([
          { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 5 },
        ]).toArray(),
        // Previous-previous month for insight comparison
        db.collection<ITransaction>('transactions').aggregate([
          {
            $match: {
              userId, type: 'expense',
              date: {
                $gte: new Date(Date.UTC(prevYear, prevMonth - 1, 1)),
                $lte: new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999)),
              },
            },
          },
          { $group: { _id: '$category', total: { $sum: '$amount' } } },
        ]).toArray(),
        db.collection<IBudget>('budgets').find({ userId }).toArray(),
      ])

      const totalIncome = incomeAgg[0]?.total ?? 0
      const totalSpent = expenseAgg[0]?.total ?? 0
      const totalSaved = Math.max(0, totalIncome - totalSpent)

      if (totalIncome === 0 && totalSpent === 0) continue // Skip users with no activity

      const spentMap = Object.fromEntries(categoryAgg.map((r) => [(r as { _id: string; total: number })._id, (r as { _id: string; total: number }).total]))
      const categoriesOnBudget = budgets.filter((b) => (spentMap[b.category] ?? 0) <= b.limit).length

      // Build insight: compare top category vs previous month
      const topCat = categoryAgg[0]
      const prevSpentMap = Object.fromEntries(prevMonthAgg.map((r) => [(r as { _id: string; total: number })._id, (r as { _id: string; total: number }).total]))
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
        { $set: { 'notifications.email.lastSent': new Date() } }
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
        topCategories: categoryAgg.map((doc, i: number) => {
          const c = doc as { _id: string; total: number; count: number }
          return {
            name: c._id,
            txnCount: c.count,
            totalSpent: fmt(c.total, sym),
            dotColor: DOT_COLORS[i % DOT_COLORS.length],
          }
        }),
        insight: {
          comparedCategory: topCat?._id ?? 'spending',
          changePercent,
          changeDirection,
          comparedMonth: prevMonthName,
          monthlySavingsFree,
        },
      }).catch((err) => console.error(`[scheduler] monthly report error for ${user.email}:`, err))
    }
  } catch (err) {
    console.error('[scheduler] monthly report job error:', err)
  }
}

// ─── Push Notifications (daily at 9 AM) ──────────────────────────────────────

async function sendPushNotifications() {
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
        sendPushNotification({ fcmToken: user.notifications.push.fcmToken, type }).catch((err) =>
          console.error(`[scheduler] push error for ${user.email}:`, err)
        )
      }
    }
  } catch (err) {
    console.error('[scheduler] push notification error:', err)
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export function startSchedulers() {
  cron.schedule('0 0 * * *', resetAiQueries)           // midnight daily
  cron.schedule('0 8 1 * *', sendMonthlyReports)        // 8 AM on 1st
  cron.schedule('0 9 15 * *', sendBudgetReminders)      // 9 AM on 15th
  cron.schedule('0 10 * * *', sendReEngageEmails)       // 10 AM daily
  cron.schedule('0 9 * * *', sendPushNotifications)     // 9 AM daily
}
