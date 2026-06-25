import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import { ObjectId } from 'mongodb'
import type { ISurvey } from '@/lib/models/Survey'
import type { IUser } from '@/lib/models/User'

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { searchParams } = new URL(req.url)
  const ratingParam = searchParams.get('rating')
  const fromParam   = searchParams.get('from')
  const toParam     = searchParams.get('to')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {}

  if (ratingParam) {
    const ratings = ratingParam.split(',').map(Number).filter((r) => r >= 1 && r <= 5)
    if (ratings.length > 0) filter.rating = { $in: ratings }
  }

  if (fromParam || toParam) {
    filter.createdAt = {}
    if (fromParam) filter.createdAt.$gte = new Date(fromParam)
    if (toParam)   filter.createdAt.$lte = new Date(toParam)
  }

  const db = await getDb()
  const surveys = await db
    .collection<ISurvey>('surveys')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray()

  const userIds = [...new Set(surveys.map((s) => s.userId.toString()))]
  const users = await db
    .collection<IUser>('users')
    .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
    .toArray()

  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), { name: u.name, email: u.email }]))

  const header = ['Date', 'Name', 'Email', 'Rating', 'Comment']
  const rows = surveys.map((s) => {
    const user = userMap[s.userId.toString()] ?? { name: 'Unknown', email: '' }
    return [
      escapeCsvField(new Date(s.createdAt).toISOString()),
      escapeCsvField(user.name),
      escapeCsvField(user.email),
      escapeCsvField(s.rating),
      escapeCsvField(s.comment),
    ].join(',')
  })

  const csv = [header.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="waiseka-surveys-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
