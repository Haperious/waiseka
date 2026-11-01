import { NextRequest, NextResponse } from 'next/server'
import { badRequest, cleanText, isHexColor, readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { ICategory } from '@/lib/models/Category'
import { MAX_CATEGORY_NAME, findCategoryNamed, renameCategoryEverywhere } from '@/lib/services/categoryNames'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { type, color } = body
  const name = cleanText(body.name, MAX_CATEGORY_NAME)

  if (!name) return NextResponse.json({ error: 'Name is required (up to 50 characters)' }, { status: 400 })
  if (color != null && !isHexColor(color)) return badRequest('color must be a hex colour like #3b82f6')
  if (!['income', 'expense', 'both'].includes(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const db = await getDb()
  const col = db.collection<ICategory>('categories')

  const conflict = await findCategoryNamed(db, session.user.id, name, _id)
  if (conflict) return NextResponse.json({ error: 'Category name already in use' }, { status: 409 })

  const before = await col.findOne({ _id, userId: session.user.id })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Leaving colour out keeps it (it used to be saved as null)
  const update: Partial<ICategory> = { name, type, updatedAt: new Date() }
  if (color != null) update.color = color
  const updated = await col.findOneAndUpdate(
    { _id, userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await renameCategoryEverywhere(db, session.user.id, before.name, name)
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const db = await getDb()
  const deleted = await db.collection<ICategory>('categories').findOneAndDelete({
    _id,
    userId: session.user.id,
  })

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted' })
}
