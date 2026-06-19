import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '@/lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '@/lib/models/User'
import { DEFAULT_CATEGORIES, type ICategory } from '@/lib/models/Category'
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// 5 registrations per IP per hour
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`register:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  try {
    const body = await req.json()
    const { name, email, password, confirmPassword } = body

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

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

    const resetDate = new Date()
    resetDate.setMonth(resetDate.getMonth() + 1)
    resetDate.setDate(1)
    resetDate.setHours(0, 0, 0, 0)

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
    })

    const userId = result.insertedId.toString()
    await db.collection<ICategory>('categories').insertMany(
      DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        userId,
        createdAt: now,
        updatedAt: now,
      })) as ICategory[]
    )

    const firstName = name.split(' ')[0]
    const lowerEmail = email.toLowerCase()

    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await db.collection('emailVerificationTokens').insertOne({
      userId: userId,
      token: verifyToken,
      expiresAt: verifyExpiry,
      createdAt: now,
    })

    const verifyUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/api/auth/verify-email?token=${verifyToken}`

    sendWelcomeEmail({ firstName, email: lowerEmail })
      .catch((err) => console.error('[register] welcome email error:', err))

    sendVerificationEmail({ firstName, email: lowerEmail, verifyUrl })
      .catch((err) => console.error('[register] verification email error:', err))

    return NextResponse.json({ message: 'Account created successfully' }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
