import admin from 'firebase-admin'
import { Db } from 'mongodb'
import { getMailTransporter, sendSpendingAlertEmail } from '@/lib/email'
import { isPremium } from '@/lib/tier'
import { formatCurrency } from '@/lib/utils'
import type { IUser } from '@/lib/models/User'
import type { IBudget } from '@/lib/models/Budget'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IEmailLog } from '@/lib/models/EmailLog'

type NotificationType = 'reminder' | 'inactivity'

const MESSAGES: Record<NotificationType, string> = {
  reminder: "Time to log your expenses!",
  inactivity: "It's been a while - come back and update your budget!",
}

export async function sendEmailNotification({
  to,
  name,
  type,
}: {
  to: string
  name: string
  type: NotificationType
}) {
  const message = MESSAGES[type]

  await getMailTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: type === 'reminder' ? 'Budget Reminder - Waiseka' : 'We miss you - Waiseka',
    text: `Hi ${name},\n\n${message}\n\nWaiseka`,
    html: `<p>Hi ${name},</p><p>${message}</p><p>- Waiseka</p>`,
  })
}

function initFirebase() {
  if (admin.apps.length > 0) return

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

/**
 * Send an FCM push notification.
 * Silently skips if the user is not on the premium tier.
 * Free users can still configure email frequency in settings but FCM push is premium-only.
 */
/**
 * Fire-and-forget spending alert: checks if a new expense crossed the budget
 * limit for its category and sends a one-time email alert per calendar month.
 * Must be called after the transaction is persisted.
 */
export async function checkSpendingAlert(
  userId: string,
  category: string,
  merchantName: string,
  triggerAmount: number,
  db: Db,
  user: Pick<IUser, 'name' | 'email' | 'preferences'>,
): Promise<void> {
  const budget = await db.collection<IBudget>('budgets').findOne({ userId, category })
  if (!budget) return

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const [spentAgg, recentTxns, allBudgetSpent] = await Promise.all([
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection<ITransaction>('transactions')
      .find({ userId, category, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } })
      .sort({ date: -1 }).limit(3).toArray(),
    db.collection<ITransaction>('transactions').aggregate([
      { $match: { userId, type: 'expense', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]).toArray(),
  ])

  const totalSpent = spentAgg[0]?.total ?? 0
  if (totalSpent <= budget.limit) return

  // Only fire on the transition from under → over limit
  const previousTotal = totalSpent - triggerAmount
  if (previousTotal >= budget.limit) return

  // Dedup: one alert per category per calendar month
  const logMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const alreadyAlerted = await db.collection<IEmailLog>('email_logs').findOne({
    userId,
    type: 'spending_alert',
    category,
    sentAt: { $gte: monthStart, $lt: logMonthEnd },
  })
  if (alreadyAlerted) return

  const sym = user.preferences?.currencySymbol ?? '₱'
  const fmt = (n: number) => formatCurrency(n, sym)

  const allBudgets = await db.collection<IBudget>('budgets').find({ userId }).toArray()
  const spentMap = Object.fromEntries(
    allBudgetSpent.map((r) => [(r as { _id: string; total: number })._id, (r as { _id: string; total: number }).total])
  )
  const surplus = allBudgets
    .filter((b: IBudget) => b.category !== category && (spentMap[b.category] ?? 0) < b.limit)
    .sort((a: IBudget, b: IBudget) => (b.limit - (spentMap[b.category] ?? 0)) - (a.limit - (spentMap[a.category] ?? 0)))[0]

  const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate()
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  await sendSpendingAlertEmail({
    firstName: user.name.split(' ')[0],
    email: user.email,
    categoryName: category,
    budgetLimit: fmt(budget.limit),
    totalSpent: fmt(totalSpent),
    overBy: fmt(totalSpent - budget.limit),
    triggerAmount: fmt(triggerAmount),
    triggerMerchant: merchantName,
    monthName,
    daysRemaining,
    recentTxns: recentTxns.map((t: ITransaction) => ({
      merchantName: t.description || t.category,
      date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      label: t.amount === triggerAmount ? 'exceeded limit' : '',
      amount: fmt(t.amount),
    })),
    surplusCategory: surplus?.category ?? 'Other',
    surplusCategoryRemaining: surplus ? fmt(surplus.limit - (spentMap[surplus.category] ?? 0)) : fmt(0),
  })

  await db.collection<Omit<IEmailLog, '_id'>>('email_logs').insertOne({
    userId,
    type: 'spending_alert',
    category,
    sentAt: now,
  } as unknown as Omit<IEmailLog, '_id'>)
}

export async function sendPushNotification({
  fcmToken,
  type,
  user,
}: {
  fcmToken: string
  type: NotificationType
  user: Pick<IUser, 'tier' | 'premiumOverride'>
}) {
  if (!isPremium(user)) {
    return
  }

  initFirebase()
  const message = MESSAGES[type]

  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: 'Waiseka',
      body: message,
    },
  })
}
