import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IBudget } from '@/lib/models/Budget'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Whitelist editable fields — never allow userId, _id, or system fields to be overwritten
  const update: Partial<IBudget> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.category !== undefined) update.category = body.category
  if (body.limit !== undefined) {
    if (typeof body.limit !== 'number' || !isFinite(body.limit) || body.limit <= 0) {
      return NextResponse.json({ error: 'limit must be a positive number' }, { status: 400 })
    }
    update.limit = body.limit
  }
  if (body.period !== undefined) {
    if (!['monthly', 'weekly'].includes(body.period)) {
      return NextResponse.json({ error: 'period must be monthly or weekly' }, { status: 400 })
    }
    update.period = body.period
  }
  if (body.color !== undefined) update.color = body.color

  const db = await getDb()
  const budget = await db.collection<IBudget>('budgets').findOneAndUpdate(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(budget)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = await getDb()
  const budget = await db.collection<IBudget>('budgets').findOneAndDelete({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
