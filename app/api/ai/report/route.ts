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

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const col = db.collection<ITransaction>('transactions')

  const [[summary], categoryBreakdown] = await Promise.all([
    col.aggregate([
      { $match: { userId: session.user.id, date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
    ]).toArray(),
    col.aggregate([
      { $match: { userId: session.user.id, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]).toArray(),
  ])

  const symbol = user.preferences.currencySymbol
  const income = summary?.totalIncome ?? 0
  const expenses = summary?.totalExpenses ?? 0
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0

  const recentSummary = {
    totalIncome: income,
    totalExpenses: expenses,
    savingsRate,
    topCategories: categoryBreakdown.map((c) => ({ category: c._id, amount: c.total })),
  }

  const transactionSummary = [
    `Month: ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
    `Total Income: ${symbol}${income.toFixed(2)}`,
    `Total Expenses: ${symbol}${expenses.toFixed(2)}`,
    `Net Savings: ${symbol}${(income - expenses).toFixed(2)}`,
    `Savings Rate: ${savingsRate.toFixed(1)}%`,
    categoryBreakdown.length
      ? `Top Categories: ${categoryBreakdown.map((c) => `${c._id} (${symbol}${c.total.toFixed(2)})`).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = [
    buildFinancialProfile(user, recentSummary),
    transactionSummary,
    'Generate a concise monthly budget report with 3 actionable tips.',
  ].join('\n\n')

  const report = await callAnthropic({
    systemPrompt,
    messages: [{ role: 'user', content: 'Please generate my monthly budget report.' }],
  })

  const newQueriesUsed = user.ai.queriesUsed + 1
  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $set: { 'ai.queriesUsed': newQueriesUsed, updatedAt: new Date() } }
  )

  const cap = user.ai.queriesCapOverride ?? settings.aiQueryCap
  return NextResponse.json({
    report,
    queriesUsed: newQueriesUsed,
    queriesRemaining: Math.max(0, cap - newQueriesUsed),
  })
}
