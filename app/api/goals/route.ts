import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import Goal from '@/lib/models/Goal'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const goals = await Goal.find({ userId: session.user.id }).sort({ createdAt: -1 })
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

  await connectDB()
  const goal = await Goal.create({
    userId: session.user.id,
    title,
    targetAmount,
    savedAmount: 0,
    deadline: deadline ? new Date(deadline) : undefined,
    priority: priority ?? 'medium',
    status: 'active',
  })

  return NextResponse.json(goal, { status: 201 })
}
