import { NextRequest, NextResponse } from 'next/server'
import { ObjectId, Db } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IGoal } from '@/lib/models/Goal'
import type { IUser } from '@/lib/models/User'
import { sendSavingsMilestoneEmail } from '@/lib/email'
import { formatCurrency } from '@/lib/utils'

const MILESTONES = [25, 50, 75, 100]

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Whitelist editable fields - never allow userId, _id, or system fields to be overwritten
  const update: Partial<IGoal> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.title !== undefined) update.title = body.title
  if (body.targetAmount !== undefined) {
    if (typeof body.targetAmount !== 'number' || !isFinite(body.targetAmount) || body.targetAmount <= 0) {
      return NextResponse.json({ error: 'targetAmount must be a positive number' }, { status: 400 })
    }
    update.targetAmount = body.targetAmount
  }
  if (body.savedAmount !== undefined) {
    if (typeof body.savedAmount !== 'number' || !isFinite(body.savedAmount) || body.savedAmount < 0) {
      return NextResponse.json({ error: 'savedAmount must be a non-negative number' }, { status: 400 })
    }
    update.savedAmount = body.savedAmount
  }
  if (body.deadline !== undefined) update.deadline = new Date(body.deadline)
  if (body.priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(body.priority)) {
      return NextResponse.json({ error: 'priority must be low, medium, or high' }, { status: 400 })
    }
    update.priority = body.priority
  }
  if (body.status !== undefined) {
    if (!['active', 'completed', 'paused'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be active, completed, or paused' }, { status: 400 })
    }
    update.status = body.status
  }

  const db = await getDb()

  // Fetch before updating so we can accurately detect milestone crossings
  const beforeGoal = await db.collection<IGoal>('goals').findOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })
  if (!beforeGoal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const goal = await db.collection<IGoal>('goals').findOneAndUpdate(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if savedAmount crossed a milestone using accurate before/after values
  if (body.savedAmount !== undefined) {
    const beforePercent = Math.floor((beforeGoal.savedAmount / beforeGoal.targetAmount) * 100)
    const afterPercent = Math.floor((goal.savedAmount / goal.targetAmount) * 100)
    const crossed = MILESTONES.find((m) => beforePercent < m && afterPercent >= m)
    if (crossed) {
      checkMilestone(session.user.id, goal, crossed, db).catch(
        (err) => console.error('[goals] milestone email error:', err)
      )
    }
  }

  return NextResponse.json(goal)
}

async function checkMilestone(userId: string, goal: IGoal, reachedPercent: number, db: Db) {
  const user = await db.collection<IUser>('users').findOne(
    { _id: userId } as never,
    { projection: { name: 1, email: 1, preferences: 1 } }
  )
  if (!user) return

  const sym = user.preferences?.currencySymbol ?? '₱'
  const fmt = (n: number) => formatCurrency(n, sym)

  const monthsSaving = Math.max(1, Math.round(
    (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  ))
  const avgPerMonth = goal.savedAmount / monthsSaving
  const remaining = goal.targetAmount - goal.savedAmount
  const monthsToTarget = avgPerMonth > 0 ? Math.ceil(remaining / avgPerMonth) : 99

  const completionDate = new Date()
  completionDate.setMonth(completionDate.getMonth() + monthsToTarget)
  const estCompletion = completionDate.toLocaleString('en-US', { month: 'short', year: '2-digit' })

  const nextMilestone = MILESTONES.find((m) => m > reachedPercent) ?? 100
  const nextMilestoneAmount = (goal.targetAmount * nextMilestone) / 100

  // Approximate rank: users at this milestone % or below / total users with goals
  const [totalGoalUsers, aheadCount] = await Promise.all([
    db.collection<IGoal>('goals').distinct('userId', { status: 'active' }).then((ids: string[]) => ids.length),
    db.collection<IGoal>('goals').aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$userId', maxPct: { $max: { $multiply: [{ $divide: ['$savedAmount', '$targetAmount'] }, 100] } } } },
      { $match: { maxPct: { $gte: reachedPercent } } },
      { $count: 'n' },
    ]).toArray().then((r) => (r[0] as { n: number } | undefined)?.n ?? 0),
  ])
  const userRankPercent = totalGoalUsers > 0 ? Math.max(5, Math.round((aheadCount / totalGoalUsers) * 100)) : 20

  await sendSavingsMilestoneEmail({
    firstName: user.name.split(' ')[0],
    email: user.email,
    goalName: goal.title,
    reachedPercent,
    monthsToTarget,
    targetAmount: fmt(goal.targetAmount),
    savedAmount: fmt(goal.savedAmount),
    monthsSaving,
    avgPerMonth: fmt(avgPerMonth),
    estCompletionMonthYear: estCompletion,
    userRankPercent,
    nextMilestoneAmount: fmt(nextMilestoneAmount),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = await getDb()
  const goal = await db.collection<IGoal>('goals').findOneAndDelete({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
