import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import type { IUser } from '@/lib/models/User'

const USER_PROJECTION = {
  name: 1, email: 1, tier: 1, premiumOverride: 1,
  'ai.enabled': 1, 'ai.queriesUsed': 1, 'ai.queriesCapOverride': 1, 'ai.resetDate': 1,
  createdAt: 1,
}

export async function GET(req: NextRequest) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const skip = (page - 1) * limit

  const db = await getDb()
  const col = db.collection<IUser>('users')
  const [users, total] = await Promise.all([
    col.find({}, { projection: USER_PROJECTION }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(),
  ])

  return NextResponse.json({ users, total, page, limit })
}
