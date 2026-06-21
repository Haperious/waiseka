import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Whitelist editable fields - never allow userId, _id, or other system fields to be overwritten
  const update: Partial<ITransaction> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    update.amount = body.amount
  }
  if (body.type !== undefined) update.type = body.type
  if (body.category !== undefined) update.category = body.category
  if (body.description !== undefined) update.description = body.description
  if (body.date !== undefined) update.date = new Date(body.date)
  if (body.isRecurring !== undefined) update.isRecurring = Boolean(body.isRecurring)

  const db = await getDb()
  const transaction = await db.collection<ITransaction>('transactions').findOneAndUpdate(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = await getDb()
  const transaction = await db.collection<ITransaction>('transactions').findOneAndDelete({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
