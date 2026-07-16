import { Collection, Db } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'
import type { INotification } from '@/lib/models/Notification'
import { getAccountActivityMap, computeAssetBalance, computeOutstanding } from '@/lib/services/accountBalance'

/**
 * Scheduler-agnostic account alert check.
 *
 * Writes in-app notifications (into the existing `notifications` collection, so
 * they surface in the notification bell) when:
 *   - an asset account's derived balance drops below its opt-in lowBalanceThreshold
 *   - a credit account's utilization crosses 70% (warning) or 90% (critical)
 *
 * Deduped to one notification per account per alertKey per calendar month, matching
 * the spending-alert dedup philosophy. The 70% and 90% credit thresholds use distinct
 * alertKeys so a card that climbs from 70% to 90% in one month still gets the critical
 * alert (it isn't suppressed by the earlier warning).
 *
 * This is a plain callable with no scheduling of its own. It is invoked by whatever
 * scheduler runs it (see the Netlify Scheduled Functions migration). Returns a summary
 * so the caller can log how many alerts were created.
 */

const CREDIT_WARN_PCT = 70
const CREDIT_CRITICAL_PCT = 90

export async function runAccountAlerts(db: Db): Promise<{ usersChecked: number; alertsCreated: number }> {
  const accountsCol = db.collection<IAccount>('accounts')
  const notificationsCol = db.collection<INotification>('notifications')

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  // Group active accounts by user so we run one activity aggregation per user.
  const activeAccounts = await accountsCol.find({ isArchived: { $ne: true } }).toArray()
  const byUser = new Map<string, IAccount[]>()
  for (const account of activeAccounts) {
    const list = byUser.get(account.userId) ?? []
    list.push(account)
    byUser.set(account.userId, list)
  }

  let alertsCreated = 0

  for (const [userId, accounts] of byUser) {
    const activityMap = await getAccountActivityMap(db, userId)

    for (const account of accounts) {
      const activity = activityMap.get(account._id.toString())

      if (account.type === 'credit') {
        if (account.creditLimit == null || account.creditLimit <= 0) continue
        const outstanding = computeOutstanding(activity)
        const utilization = (outstanding / account.creditLimit) * 100

        if (utilization >= CREDIT_CRITICAL_PCT) {
          alertsCreated += await createIfNew(notificationsCol, monthStart, {
            userId,
            type: 'credit_utilization',
            category: '',
            accountId: account._id.toString(),
            alertKey: 'util_90',
            color: 'var(--color-expense)',
            message: `${account.name} is at ${Math.round(utilization)}% of its credit limit. Consider paying it down.`,
          })
        } else if (utilization >= CREDIT_WARN_PCT) {
          alertsCreated += await createIfNew(notificationsCol, monthStart, {
            userId,
            type: 'credit_utilization',
            category: '',
            accountId: account._id.toString(),
            alertKey: 'util_70',
            color: 'var(--color-warning)',
            message: `${account.name} is at ${Math.round(utilization)}% of its credit limit.`,
          })
        }
      } else {
        // Asset accounts: opt-in low-balance threshold only
        if (account.lowBalanceThreshold == null) continue
        const balance = computeAssetBalance(account.openingBalance, activity)
        if (balance < account.lowBalanceThreshold) {
          alertsCreated += await createIfNew(notificationsCol, monthStart, {
            userId,
            type: 'low_balance',
            category: '',
            accountId: account._id.toString(),
            alertKey: 'low_balance',
            color: 'var(--color-warning)',
            message: `${account.name} is running low. Balance is below your set threshold.`,
          })
        }
      }
    }
  }

  return { usersChecked: byUser.size, alertsCreated }
}

/**
 * Inserts a notification only if an equivalent one (same account + alertKey) hasn't
 * already been sent this calendar month. Returns 1 if inserted, 0 if deduped.
 */
async function createIfNew(
  notificationsCol: Collection<INotification>,
  monthStart: Date,
  fields: {
    userId: string
    type: INotification['type']
    category: string
    accountId: string
    alertKey: string
    color: string
    message: string
  }
): Promise<number> {
  const existing = await notificationsCol.findOne({
    userId: fields.userId,
    accountId: fields.accountId,
    alertKey: fields.alertKey,
    createdAt: { $gte: monthStart },
  })
  if (existing) return 0

  await notificationsCol.insertOne({
    ...fields,
    read: false,
    createdAt: new Date(),
  } as unknown as INotification)
  return 1
}
