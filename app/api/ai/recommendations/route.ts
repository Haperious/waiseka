import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { aiGate } from '@/lib/ai-gate'
import { buildFinancialProfile, callAnthropic } from '@/lib/ai'
import type { IUser } from '@/lib/models/User'
import type { ITransaction } from '@/lib/models/Transaction'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const [user, settings] = await Promise.all([
    db.collection<IUser>('users').findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { 'ai.conversations': 0 } }
    ),
    getSettings(),
  ])
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const gateError = aiGate(user, settings)
  if (gateError) return gateError

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const col = db.collection<ITransaction>('transactions')

  const [[totals], topCategories] = await Promise.all([
    col.aggregate([
      { $match: { userId: session.user.id, date: { $gte: threeMonthsAgo } } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
    ]).toArray(),
    col.aggregate([
      { $match: { userId: session.user.id, type: 'expense', date: { $gte: threeMonthsAgo } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]).toArray(),
  ])

  const symbol = user.preferences.currencySymbol
  const avgIncome = totals ? totals.totalIncome / 3 : 0
  const avgExpenses = totals ? totals.totalExpenses / 3 : 0
  const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpenses) / avgIncome) * 100 : 0

  const recentSummary = {
    totalIncome: avgIncome,
    totalExpenses: avgExpenses,
    savingsRate,
    topCategories: topCategories.map((c) => ({ category: c._id, amount: c.total / 3 })),
  }

  const categorySummary = topCategories.length
    ? `Top expense categories (3-month average):\n${topCategories
        .map((c) => `- ${c._id}: ${symbol}${(c.total / 3).toFixed(2)}/month`)
        .join('\n')}`
    : 'No expense data available.'

  const systemPrompt = [
    buildFinancialProfile(user, recentSummary),
    categorySummary,
    'Suggest 3 specific, actionable ways this user can increase their savings based on their spending patterns.',
  ].join('\n\n')

  const result = await callAnthropic({
    systemPrompt,
    messages: [{ role: 'user', content: 'What are 3 specific ways I can increase my savings?' }],
  })

  const newQueriesUsed = user.ai.queriesUsed + 1
  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $set: { 'ai.queriesUsed': newQueriesUsed, updatedAt: new Date() } }
  )

  return NextResponse.json({ recommendations: result, queriesUsed: newQueriesUsed })
}
