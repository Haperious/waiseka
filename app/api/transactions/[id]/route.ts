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

  const update: Partial<ITransaction> & { updatedAt: Date } = {
    ...body,
    updatedAt: new Date(),
  }
  if (body.date) update.date = new Date(body.date)

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
