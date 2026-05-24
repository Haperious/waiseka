import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import type { IUser } from '@/lib/models/User'

export async function GET() {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const db = await getDb()
  const col = db.collection<IUser>('users')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [[stats], aiQueriesThisMonth] = await Promise.all([
    col.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                freeUsers: { $sum: { $cond: [{ $eq: ['$tier', 'free'] }, 1, 0] } },
                premiumUsers: { $sum: { $cond: [{ $eq: ['$tier', 'premium'] }, 1, 0] } },
                totalAiQueries: { $sum: '$ai.queriesUsed' },
                emailEnabled: { $sum: { $cond: ['$notifications.email.enabled', 1, 0] } },
                pushEnabled: { $sum: { $cond: ['$notifications.push.enabled', 1, 0] } },
              },
            },
          ],
        },
      },
      { $unwind: '$totals' },
      { $replaceRoot: { newRoot: '$totals' } },
    ]).toArray(),
    col.aggregate([
      { $match: { 'ai.resetDate': { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$ai.queriesUsed' } } },
    ]).toArray(),
  ])

  return NextResponse.json({
    totalUsers: stats?.totalUsers ?? 0,
    freeUsers: stats?.freeUsers ?? 0,
    premiumUsers: stats?.premiumUsers ?? 0,
    totalAiQueriesThisMonth: aiQueriesThisMonth[0]?.total ?? 0,
    emailNotificationsEnabled: stats?.emailEnabled ?? 0,
    pushNotificationsEnabled: stats?.pushEnabled ?? 0,
  })
}
