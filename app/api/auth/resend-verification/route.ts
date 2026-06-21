import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { sendVerificationEmail } from '@/lib/email'
import type { IUser } from '@/lib/models/User'
import type { IEmailLog } from '@/lib/models/EmailLog'

const EXPIRY_HOURS = 24

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { name: 1, email: 1, isVerified: 1 } }
  )

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.isVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

  // Delete any existing unused tokens for this user
  await db.collection('emailVerificationTokens').deleteMany({ userId: session.user.id })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000)

  await db.collection('emailVerificationTokens').insertOne({
    userId: session.user.id,
    token,
    expiresAt,
    createdAt: new Date(),
  })

  const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/api/auth/verify-email?token=${token}`

  sendVerificationEmail({
    firstName: user.name.split(' ')[0],
    email: user.email,
    verifyUrl,
  })
    .then(() =>
      db.collection<Omit<IEmailLog, '_id'>>('email_logs').insertOne({
        userId: session.user.id,
        type: 'email_verification',
        sentAt: new Date(),
      } as unknown as Omit<IEmailLog, '_id'>)
    )
    .catch((err) => console.error('[resend-verification] email error:', err))

  return NextResponse.json({ message: 'Verification email sent' })
}
