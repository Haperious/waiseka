import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import Budget from '@/lib/models/Budget'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const budgets = await Budget.find({ userId: session.user.id }).sort({ createdAt: -1 })
  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { category, limit, period, color } = body

  if (!category || !limit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await connectDB()
  const budget = await Budget.create({
    userId: session.user.id,
    category,
    limit,
    period: period ?? 'monthly',
    spent: 0,
    color,
  })

  return NextResponse.json(budget, { status: 201 })
}
