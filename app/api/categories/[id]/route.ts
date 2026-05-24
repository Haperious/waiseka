import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { ICategory } from '@/lib/models/Category'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, type, color } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!['income', 'expense', 'both'].includes(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const db = await getDb()
  const col = db.collection<ICategory>('categories')

  const conflict = await col.findOne({
    userId: session.user.id,
    name: name.trim(),
    _id: { $ne: new ObjectId(id) },
  })
  if (conflict) return NextResponse.json({ error: 'Category name already in use' }, { status: 409 })

  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), userId: session.user.id },
    { $set: { name: name.trim(), type, color, updatedAt: new Date() } },
    { returnDocument: 'after' }
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = await getDb()
  const deleted = await db.collection<ICategory>('categories').findOneAndDelete({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted' })
}
