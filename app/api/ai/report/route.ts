import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { aiGate } from '@/lib/ai-gate'
import { buildFinancialProfile, callAnthropic } from '@/lib/ai'
import type { IUser } from '@/lib/models/User'
import { primaryCurrencyOf } from '@/lib/services/currencyScope'
import { summarizeByCurrency, otherCurrencyBlock, MULTI_CURRENCY_RULE } from '@/lib/services/aiContext'

export async function POST() {
  const session = await requireVerifiedSession()
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
  // Per currency, primary first - the primary's figures fill the usual report; any
  // other currency gets its own labelled block (never added to the primary's)
  const [primarySummary, ...others] = await summarizeByCurrency(
    db, session.user.id, primaryCurrencyOf(user), startDate, endDate,
  )

  const symbol = user.preferences.currencySymbol
  const income = primarySummary.income
  const expenses = primarySummary.expenses
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0
  const categoryBreakdown = primarySummary.topCategories.map((c) => ({ _id: c.category, total: c.amount }))

  const recentSummary = {
    totalIncome: income,
    totalExpenses: expenses,
    savingsRate,
    topCategories: primarySummary.topCategories,
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
    ...others.map((s) => otherCurrencyBlock(s)),
    others.length ? MULTI_CURRENCY_RULE : '',
    'Generate a concise monthly budget report with 3 actionable tips.',
  ].filter(Boolean).join('\n\n')

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
