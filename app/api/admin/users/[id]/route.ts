import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import type { IUser } from '@/lib/models/User'

const USER_PROJECTION = {
  name: 1, email: 1, tier: 1, premiumOverride: 1,
  'ai.enabled': 1, 'ai.queriesUsed': 1, 'ai.queriesCapOverride': 1, 'ai.resetDate': 1,
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const update: Record<string, unknown> = { updatedAt: new Date() }
  const invalid = (field: string) => NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
  if (body.tier !== undefined) {
    if (body.tier !== 'free' && body.tier !== 'premium') return invalid('tier')
    update.tier = body.tier
  }
  if (body.premiumOverride !== undefined) {
    if (typeof body.premiumOverride !== 'boolean') return invalid('premiumOverride')
    update.premiumOverride = body.premiumOverride
  }
  if (body['ai.enabled'] !== undefined) {
    if (typeof body['ai.enabled'] !== 'boolean') return invalid('ai.enabled')
    update['ai.enabled'] = body['ai.enabled']
  }
  if (body['ai.queriesCapOverride'] !== undefined) {
    const cap = body['ai.queriesCapOverride']
    if (cap !== null && !(Number.isInteger(cap) && cap >= 0)) return invalid('ai.queriesCapOverride')
    update['ai.queriesCapOverride'] = cap
  }

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id },
    { $set: update },
    { returnDocument: 'after', projection: USER_PROJECTION }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user)
}
