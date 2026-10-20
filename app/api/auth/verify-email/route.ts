import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'
import { APP_URL } from '@/lib/app-url'
import { hashEmailToken, isResetToken } from '@/lib/resetToken'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=missing`)
  }
  if (!isResetToken(token)) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=invalid`)
  }

  // Check and use up the link in one step; tokens are stored only as their hash
  const db = await getDb()
  const record = await db.collection('emailVerificationTokens').findOneAndDelete({
    tokenHash: hashEmailToken(token),
    expiresAt: { $gt: new Date() },
  })

  if (!record) {
    return NextResponse.redirect(`${APP_URL}/verify-email?error=invalid`)
  }

  await db.collection<IUser>('users').updateOne(
    { _id: new ObjectId(record.userId) },
    { $set: { isVerified: true, updatedAt: new Date() } }
  )

  return NextResponse.redirect(`${APP_URL}/verify-email?success=true`)
}
