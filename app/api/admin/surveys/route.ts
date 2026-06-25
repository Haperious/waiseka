import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import { ObjectId } from 'mongodb'
import type { ISurvey } from '@/lib/models/Survey'
import type { IUser } from '@/lib/models/User'

export async function GET(req: NextRequest) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const skip   = (page - 1) * limit

  const ratingParam = searchParams.get('rating')   // e.g. "1,2,3"
  const fromParam   = searchParams.get('from')     // ISO date string
  const toParam     = searchParams.get('to')       // ISO date string

  // Build filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}

  if (ratingParam) {
    const ratings = ratingParam
      .split(',')
      .map(Number)
      .filter((r) => r >= 1 && r <= 5)
    if (ratings.length > 0) filter.rating = { $in: ratings }
  }

  if (fromParam || toParam) {
    filter.createdAt = {}
    if (fromParam) filter.createdAt.$gte = new Date(fromParam)
    if (toParam)   filter.createdAt.$lte = new Date(toParam)
  }

  const db = await getDb()
  const col = db.collection<ISurvey>('surveys')

  const [surveys, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter),
  ])

  // Enrich with user name + email
  const userIds = [...new Set(surveys.map((s) => s.userId.toString()))]
  const users = await db
    .collection<IUser>('users')
    .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
    .toArray()

  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), { name: u.name, email: u.email }]))

  const enriched = surveys.map((s) => ({
    _id: s._id.toString(),
    rating: s.rating,
    comment: s.comment ?? null,
    createdAt: s.createdAt,
    user: userMap[s.userId.toString()] ?? { name: 'Unknown', email: '' },
  }))

  return NextResponse.json({ surveys: enriched, total, page, limit })
}
