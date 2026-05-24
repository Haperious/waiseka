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

  const db = await getDb()
  const budget = await db.collection<IBudget>('budgets').findOneAndUpdate(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: { ...body, updatedAt: new Date() } },
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
