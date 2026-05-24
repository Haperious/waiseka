import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IGoal } from '@/lib/models/Goal'

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

  if (!title || !targetAmount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()
  const result = await db.collection<IGoal>('goals').insertOne({
    userId: session.user.id,
    title,
    targetAmount,
    savedAmount: 0,
    deadline: deadline ? new Date(deadline) : undefined,
    priority: priority ?? 'medium',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  } as IGoal)

  const goal = await db.collection<IGoal>('goals').findOne({ _id: result.insertedId })
  return NextResponse.json(goal, { status: 201 })
}
