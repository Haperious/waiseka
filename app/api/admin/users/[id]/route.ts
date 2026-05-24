import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import type { IUser } from '@/lib/models/User'

const USER_PROJECTION = {
  name: 1, email: 1, tier: 1, premiumOverride: 1,
  'ai.enabled': 1, 'ai.queriesUsed': 1, 'ai.queriesCapOverride': 1, 'ai.resetDate': 1,
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (body.tier !== undefined) update.tier = body.tier
  if (body.premiumOverride !== undefined) update.premiumOverride = body.premiumOverride
  if (body['ai.enabled'] !== undefined) update['ai.enabled'] = body['ai.enabled']
  if (body['ai.queriesCapOverride'] !== undefined) update['ai.queriesCapOverride'] = body['ai.queriesCapOverride']

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after', projection: USER_PROJECTION }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user)
}
