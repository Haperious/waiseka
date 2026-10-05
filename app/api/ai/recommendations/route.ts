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

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  // Per currency, primary first - the primary's figures fill the usual prompt; any
  // other currency gets its own labelled block (never added to the primary's)
  const [primarySummary, ...others] = await summarizeByCurrency(
    db, session.user.id, primaryCurrencyOf(user), threeMonthsAgo,
  )
  const topCategories = primarySummary.topCategories.map((c) => ({ _id: c.category, total: c.amount }))

  const symbol = user.preferences.currencySymbol
  const avgIncome = primarySummary.income / 3
  const avgExpenses = primarySummary.expenses / 3
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
    ...others.map((s) => otherCurrencyBlock(s, 3, '3-month average')),
    others.length ? MULTI_CURRENCY_RULE : '',
    'Suggest 3 specific, actionable ways this user can increase their savings based on their spending patterns.',
  ].filter(Boolean).join('\n\n')

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
