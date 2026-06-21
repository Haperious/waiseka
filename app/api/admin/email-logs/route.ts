import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import type { EmailLogType } from '@/lib/models/EmailLog'

export async function GET(req: NextRequest) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const skip  = (page - 1) * limit
  const type  = searchParams.get('type') as EmailLogType | null
  const search = searchParams.get('search')?.trim() ?? ''

  const db = await getDb()

  // If searching, resolve matching userIds first
  let userIdFilter: string[] | null = null
  if (search) {
    const regex = new RegExp(search, 'i')
    const matchedUsers = await db.collection('users')
      .find(
        { $or: [{ name: regex }, { email: regex }] },
        { projection: { _id: 1 } }
      )
      .toArray()
    userIdFilter = matchedUsers.map((u) => u._id.toString())
  }

  // Build match stage
  const matchStage: Record<string, unknown> = {}
  if (type) matchStage.type = type
  if (userIdFilter !== null) matchStage.userId = { $in: userIdFilter }

  const pipeline = [
    { $match: matchStage },
    { $sort: { sentAt: -1 } },
    {
      $facet: {
        logs: [
          { $skip: skip },
          { $limit: limit },
          {
            $addFields: {
              userObjectId: {
                $convert: { input: '$userId', to: 'objectId', onError: null, onNull: null },
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userObjectId',
              foreignField: '_id',
              pipeline: [{ $project: { name: 1, email: 1 } }],
              as: 'userDocs',
            },
          },
          {
            $addFields: {
              userName:  { $ifNull: [{ $arrayElemAt: ['$userDocs.name',  0] }, null] },
              userEmail: { $ifNull: [{ $arrayElemAt: ['$userDocs.email', 0] }, null] },
            },
          },
          { $project: { userDocs: 0, userObjectId: 0 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]

  const [result] = await db.collection('email_logs').aggregate(pipeline).toArray()
  const logs  = result?.logs  ?? []
  const total = result?.total?.[0]?.count ?? 0

  return NextResponse.json({ logs, total, page, limit })
}
