import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { DEFAULT_CATEGORIES, type ICategory } from '@/lib/models/Category'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const col = db.collection<ICategory>('categories')

  let categories = await col
    .find({ userId: session.user.id })
    .sort({ name: 1 })
    .toArray()

  if (categories.length === 0) {
    const now = new Date()
    const docs = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      userId: session.user.id,
      createdAt: now,
      updatedAt: now,
    })) as Omit<ICategory, '_id'>[]

    await col.insertMany(docs as ICategory[])
    categories = await col.find({ userId: session.user.id }).sort({ name: 1 }).toArray()
  }

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, color } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!['income', 'expense', 'both'].includes(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const db = await getDb()
  const col = db.collection<ICategory>('categories')

  const existing = await col.findOne({ userId: session.user.id, name: name.trim() })
  if (existing) return NextResponse.json({ error: 'Category already exists' }, { status: 409 })

  const now = new Date()
  const result = await col.insertOne({
    userId: session.user.id,
    name: name.trim(),
    type,
    color: color ?? '#6b7280',
    createdAt: now,
    updatedAt: now,
  } as ICategory)

  const category = await col.findOne({ _id: result.insertedId })
  return NextResponse.json(category, { status: 201 })
}
