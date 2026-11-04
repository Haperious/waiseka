import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'
import { readPaging } from '@/lib/transactionInput'

const USER_PROJECTION = {
  name: 1, email: 1, tier: 1, premiumOverride: 1, isVerified: 1,
  'ai.enabled': 1, 'ai.queriesUsed': 1, 'ai.queriesCapOverride': 1, 'ai.resetDate': 1,
  lastLogin: 1,
  createdAt: 1,
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(req.url)
  // Bounded: a bad ?page= or ?limit= used to crash the query, and limit=0 meant no limit
  const { page, limit } = readPaging(searchParams)
  const skip = (page - 1) * limit

  const db = await getDb()
  const col = db.collection<IUser>('users')
  const [users, total] = await Promise.all([
    col.find({}, { projection: USER_PROJECTION }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(),
  ])

  return NextResponse.json({ users, total, page, limit })
}
