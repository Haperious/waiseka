import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { aiGate } from '@/lib/ai-gate'
import { buildFinancialProfile, callAnthropic } from '@/lib/ai'
import type { IUser } from '@/lib/models/User'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IGoal } from '@/lib/models/Goal'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goalId } = await req.json()
  if (!goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 })

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

  const goal = await db.collection<IGoal>('goals').findOne({
    _id: new ObjectId(goalId),
    userId: session.user.id,
  })
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const [monthlySavings] = await db.collection<ITransaction>('transactions').aggregate([
    { $match: { userId: session.user.id, date: { $gte: threeMonthsAgo } } },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
      },
    },
  ]).toArray()

  const avgMonthlySavings = monthlySavings
    ? (monthlySavings.totalIncome - monthlySavings.totalExpenses) / 3
    : 0

  const symbol = user.preferences.currencySymbol
  const remaining = goal.targetAmount - goal.savedAmount
  const deadlineStr = goal.deadline
    ? new Date(goal.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'no deadline set'

  const goalContext = [
    `Goal: ${goal.title}`,
    `Target: ${symbol}${goal.targetAmount}`,
    `Saved: ${symbol}${goal.savedAmount}`,
    `Remaining: ${symbol}${remaining}`,
    `Deadline: ${deadlineStr}`,
    `Priority: ${goal.priority}`,
    `Average monthly savings (last 3 months): ${symbol}${avgMonthlySavings.toFixed(2)}`,
  ].join('\n')

  const systemPrompt = [
    buildFinancialProfile(user, {
      totalIncome: monthlySavings ? monthlySavings.totalIncome / 3 : 0,
      totalExpenses: monthlySavings ? monthlySavings.totalExpenses / 3 : 0,
    }),
    goalContext,
    'Assess whether this goal is feasible by its deadline based on current savings rate. Be specific about the timeline and any adjustments needed.',
  ].join('\n\n')

  const analysis = await callAnthropic({
    systemPrompt,
    messages: [{ role: 'user', content: `Is my goal "${goal.title}" feasible by the deadline?` }],
  })

  let feasible = false
  if (goal.deadline && avgMonthlySavings > 0) {
    const monthsUntilDeadline =
      (new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    feasible = avgMonthlySavings * monthsUntilDeadline >= remaining
  }

  const newQueriesUsed = user.ai.queriesUsed + 1
  await db.collection<IUser>('users').updateOne(
    { _id: user._id },
    { $set: { 'ai.queriesUsed': newQueriesUsed, updatedAt: new Date() } }
  )

  return NextResponse.json({ analysis, feasible, queriesUsed: newQueriesUsed })
}
