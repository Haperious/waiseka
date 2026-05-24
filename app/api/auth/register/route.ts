import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import { CURRENCY_SYMBOL_MAP } from '@/lib/models/User'
import { DEFAULT_CATEGORIES, type ICategory } from '@/lib/models/Category'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, confirmPassword } = body
     
    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
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

    sendWelcomeEmail({ firstName: name.split(' ')[0], email: email.toLowerCase() })
      .catch((err) => console.error('[register] welcome email error:', err))

    return NextResponse.json({ message: 'Account created successfully' }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
