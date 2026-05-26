import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=missing`)
  }

  const db = await getDb()
  const record = await db.collection('emailVerificationTokens').findOne({
    token,
    expiresAt: { $gt: new Date() },
  })

  if (!record) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=invalid`)
  }

  await Promise.all([
    db.collection<IUser>('users').updateOne(
      { _id: new ObjectId(record.userId) },
      { $set: { isVerified: true, updatedAt: new Date() } }
    ),
    db.collection('emailVerificationTokens').deleteOne({ _id: record._id }),
  ])

  return NextResponse.redirect(`${APP_URL}/verify-email?success=true`)
}
