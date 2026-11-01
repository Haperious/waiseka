import { NextRequest, NextResponse } from 'next/server'
import { badRequest, cleanText, isHexColor, readJsonBody } from '@/lib/request'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { IBudget } from '@/lib/models/Budget'
import { INVALID_CURRENCY_MESSAGE, isCurrencyCode, primaryCurrencyOf } from '@/lib/services/currencyScope'
import { readAmount } from '@/lib/money'
import { findDuplicateBudget } from '@/lib/services/budgetSpending'
import type { IUser } from '@/lib/models/User'
import { ObjectId } from 'mongodb'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  // Whitelist editable fields - never allow userId, _id, or system fields to be overwritten
  const update: Partial<IBudget> & { updatedAt: Date } = { updatedAt: new Date() }
  if (body.category !== undefined) {
    const category = cleanText(body.category, 100)
    if (!category) return badRequest('category must be 1-100 characters')
    update.category = category
  }
  if (body.limit !== undefined) {
    const limit = readAmount(body.limit)
    if (limit === null) {
      return NextResponse.json({ error: 'limit must be a positive number up to 1,000,000,000,000' }, { status: 400 })
    }
    update.limit = limit
  }
  if (body.period !== undefined) {
    if (!['monthly', 'weekly'].includes(body.period)) {
      return NextResponse.json({ error: 'period must be monthly or weekly' }, { status: 400 })
    }
    update.period = body.period
  }
  if (body.color !== undefined) {
    if (!isHexColor(body.color)) return badRequest('color must be a hex colour like #3b82f6')
    update.color = body.color
  }
  // Safe to change: spent is derived on read, never stored
  if (body.currency !== undefined) {
    if (!isCurrencyCode(body.currency)) {
      return NextResponse.json({ error: INVALID_CURRENCY_MESSAGE }, { status: 400 })
    }
    update.currency = body.currency
  }

  const db = await getDb()
  if (update.category !== undefined || update.period !== undefined || update.currency !== undefined) {
    const existing = await db.collection<IBudget>('budgets').findOne({ _id, userId: session.user.id })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) }, { projection: { preferences: 1 } })
    const primary = primaryCurrencyOf(user)
    const duplicate = await findDuplicateBudget(
      db, session.user.id,
      update.category ?? existing.category,
      update.period ?? existing.period,
      update.currency ?? existing.currency ?? primary,
      primary, _id,
    )
    if (duplicate) return NextResponse.json({ error: 'You already have a budget for this category.' }, { status: 409 })
  }
  const budget = await db.collection<IBudget>('budgets').findOneAndUpdate(
    { _id, userId: session.user.id },
    { $set: update },
    { returnDocument: 'after' }
  )

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(budget)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const db = await getDb()
  const budget = await db.collection<IBudget>('budgets').findOneAndDelete({
    _id,
    userId: session.user.id,
  })

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted successfully' })
}
