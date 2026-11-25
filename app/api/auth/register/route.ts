import { NextRequest, NextResponse } from 'next/server'
import { readEmail, readJsonBody } from '@/lib/request'
import { cleanUserText } from '@/lib/text'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '@/lib/models/User'
import { DEFAULT_CATEGORIES, type ICategory } from '@/lib/models/Category'
import type { IAccount } from '@/lib/models/Account'
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit'
import { logEmail } from '@/lib/models/EmailLog'
import { runAfterResponse } from '@/lib/background'
import { APP_URL } from '@/lib/app-url'
import { createEmailToken } from '@/lib/resetToken'
import { newPasswordError } from '@/lib/passwordStrength'

// 5 registrations per IP per hour
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`register:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) return tooManyRequests(rl)

  try {
    const body = await readJsonBody(req)
    if (body instanceof NextResponse) return body
    const { password, confirmPassword } = body
    // Same cleaning as a rename (/api/users/me): a name of invisible characters is no name
    const name = typeof body.name === 'string' ? cleanUserText(body.name) : ''
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : ''

    if (!name || !rawEmail || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }

    const email = readEmail(rawEmail)
    if (!email) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const passwordError = newPasswordError(password)
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }
   
    const db = await getDb()
    const users = db.collection('users')

    const existing = await users.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Midnight on the 1st of next month. Built directly - setMonth(+1) on the 29th-31st
    // overflows (Jan 31 -> Mar 3), which then landed on Mar 1 and skipped February.
    const today = new Date()
    const resetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    const now = new Date()
    const result = await users.insertOne({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      avatar: null,
      role: 'user',
      isVerified: false,
      tier: 'free',
      premiumOverride: false,
      isAdmin: false,
      preferences: { currency: 'PHP', currencySymbol: CURRENCY_SYMBOL_MAP['PHP'] },
      ai: {
        enabled: true,
        queriesUsed: 0,
        queriesCapOverride: null,
        resetDate,
        conversations: [],
      },
      notifications: {
        email: { enabled: false, frequency: 'weekly' },
        push: { enabled: false, frequency: 'weekly', fcmToken: null },
        lastSeen: now,
      },
      onboarding: {
        completedAt: null,
        stepsCompleted: [],
        dismissed: false,
      },
      createdAt: now,
      updatedAt: now,
    }).catch((err: unknown) => {
      // Another sign-up with this email won the race; the unique index on email refused this one
      if ((err as { code?: number }).code === 11000) return null
      throw err
    })
    if (!result) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const userId = result.insertedId.toString()
    await db.collection<ICategory>('categories').insertMany(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        userId,
        createdAt: now,
        updatedAt: now,
      })) as ICategory[]
    )

    // Give every new user a starting account so the transaction form's account
    // dropdown is never empty on first visit. Mirrors scripts/backfill-default-accounts.ts,
    // which does the same for pre-existing users.
    await db.collection<IAccount>('accounts').insertOne({
      _id: new ObjectId(),
      userId,
      name: 'Cash on Hand',
      type: 'debit',
      openingBalance: 0,
      openingBalanceDate: now,
      lastVerifiedAt: now,
      currency: 'PHP',
      creditLimit: null,
      dueDay: null,
      lowBalanceThreshold: null,
      color: null,
      icon: null,
      displayOrder: 0,
      isArchived: false,
      includeInTotal: true,
      createdAt: now,
      updatedAt: now,
    })

    const firstName = name.split(' ')[0]
    const lowerEmail = email.toLowerCase()

    const { token: verifyToken, tokenHash } = createEmailToken()
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await db.collection('emailVerificationTokens').insertOne({
      userId: userId,
      tokenHash,
      expiresAt: verifyExpiry,
      createdAt: now,
    })

    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${verifyToken}`

    runAfterResponse('register welcome email', async () => {
      await sendWelcomeEmail({ firstName, email: lowerEmail })
      await logEmail(db, { userId, type: 'welcome' })
    })
    runAfterResponse('register verification email', async () => {
      await sendVerificationEmail({ firstName, email: lowerEmail, verifyUrl })
      await logEmail(db, { userId, type: 'email_verification' })
    })

    return NextResponse.json({ message: 'Account created successfully' }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
