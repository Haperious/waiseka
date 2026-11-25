import { NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { sendVerificationEmail } from '@/lib/email'
import type { IUser } from '@/lib/models/User'
import { logEmail } from '@/lib/models/EmailLog'
import { APP_URL } from '@/lib/app-url'
import { createEmailToken } from '@/lib/resetToken'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { runAfterResponse } from '@/lib/background'

const EXPIRY_HOURS = 24
// Anyone can sign up with someone else's address, so without a cap this would let them
// flood that inbox (and burn the app's sending quota) one click at a time
const RESEND_LIMIT = 3
const RESEND_WINDOW_MS = 60 * 60 * 1000

export async function POST() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(`resend-verification:${session.user.id}`, RESEND_LIMIT, RESEND_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl, 'Too many verification emails. Please check your inbox or try again later.')

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { name: 1, email: 1, isVerified: 1 } }
  )

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.isVerified) return NextResponse.json({ error: 'Email already verified' }, { status: 400 })

  // Delete any existing unused tokens for this user
  await db.collection('emailVerificationTokens').deleteMany({ userId: session.user.id })

  const { token, tokenHash } = createEmailToken()
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000)

  await db.collection('emailVerificationTokens').insertOne({
    userId: session.user.id,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
  })

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`

  runAfterResponse('resend-verification email', async () => {
    await sendVerificationEmail({ firstName: user.name.split(' ')[0], email: user.email, verifyUrl })
    await logEmail(db, { userId: session.user.id, type: 'email_verification' })
  })

  return NextResponse.json({ message: 'Verification email sent' })
}
