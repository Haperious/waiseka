import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_GOAL_LIMIT } from '@/lib/constants'
import { ObjectId } from 'mongodb'
import type { IGoal } from '@/lib/models/Goal'
import type { IUser } from '@/lib/models/User'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const goals = await db
    .collection<IGoal>('goals')
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .toArray()
  return NextResponse.json(goals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, targetAmount, deadline, priority } = body

  if (!title || !targetAmount || !deadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = await getDb()

  // -- Tier gate: free users capped at FREE_GOAL_LIMIT active goals
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!isPremium(user)) {
    const activeCount = await db.collection<IGoal>('goals').countDocuments({
      userId: session.user.id,
      status: 'active',
    })
    if (activeCount >= FREE_GOAL_LIMIT) {
      return NextResponse.json(
        { error: `Free plan is limited to ${FREE_GOAL_LIMIT} active goals. Upgrade to Premium to add more.` },
        { status: 403 }
      )
    }
  }

  const now = new Date()
  const result = await db.collection<IGoal>('goals').insertOne({
    userId: session.user.id,
    title,
    targetAmount,
    savedAmount: 0,
    deadline: new Date(deadline),
    priority: priority ?? 'medium',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  } as IGoal)

  const goal = await db.collection<IGoal>('goals').findOne({ _id: result.insertedId })
  return NextResponse.json(goal, { status: 201 })
}
