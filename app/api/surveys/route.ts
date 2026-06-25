import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { ISurvey } from '@/lib/models/Survey'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { rating, comment } = body

  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be a number between 1 and 5' }, { status: 400 })
  }

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return NextResponse.json({ error: 'Comment must be a string' }, { status: 400 })
    }
    if (comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or fewer' }, { status: 400 })
    }
  }

  const db = await getDb()

  // Ensure index exists (idempotent)
  await db.collection('surveys').createIndex({ userId: 1, createdAt: -1 })

  const survey: Omit<ISurvey, '_id'> = {
    userId: new ObjectId(session.user.id),
    rating: rating as 1 | 2 | 3 | 4 | 5,
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
    createdAt: new Date(),
  }

  const result = await db.collection<Omit<ISurvey, '_id'>>('surveys').insertOne(survey)

  return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 })
}
