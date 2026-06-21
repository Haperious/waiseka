import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { sendSetupNudgeEmail } from '@/lib/email'
import type { IEmailLog } from '@/lib/models/EmailLog'
import type { IBudget } from '@/lib/models/Budget'
import type { IUser } from '@/lib/models/User'

// This route is called exclusively by the MongoDB Atlas Scheduled Trigger.
// It is NOT user-facing and must be protected by a shared secret.
//
// Atlas Trigger sends: POST /api/email/setup-nudge
// Body: { secret: string; userId: string; noBudget: boolean; noGoals: boolean }
//
// The trigger pre-computes noBudget/noGoals via an aggregation pipeline,
// so this route skips those DB queries when the flags are provided.

const ATLAS_SECRET = process.env.ATLAS_TRIGGER_SECRET

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (!body || body.secret !== ATLAS_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, noBudget: noBudgetFlag, noGoals: noGoalsFlag } = body as {
    secret: string
    userId: string
    noBudget?: boolean
    noGoals?: boolean
  }
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const db = await getDb()

  // ── Load user (needed for name + email) ───────────────────────────────────
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── Grace period: safety net in case trigger skips this check ─────────────
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  if (new Date(user.createdAt) > sevenDaysAgo) {
    return NextResponse.json({ skipped: true, reason: 'grace_period' })
  }

  // ── Once-a-month cap: safety net — trigger already filters this, but guard anyway ──
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const alreadySent = await db.collection<IEmailLog>('email_logs').findOne({
    userId,
    type: 'setup_nudge',
    sentAt: { $gte: monthStart, $lt: monthEnd },
  })
  if (alreadySent) {
    return NextResponse.json({ skipped: true, reason: 'already_sent_this_month' })
  }

  // ── Budget/goals flags: use pre-computed values from trigger if provided ───
  // Falls back to a DB query for manual/test calls that omit the flags.
  let noBudget: boolean
  let noGoals: boolean

  if (noBudgetFlag !== undefined && noGoalsFlag !== undefined) {
    noBudget = noBudgetFlag
    noGoals = noGoalsFlag
  } else {
    const [budgetCount, goalCount] = await Promise.all([
      db.collection<IBudget>('budgets').countDocuments({ userId }),
      db.collection('goals').countDocuments({ userId }),
    ])
    noBudget = budgetCount === 0
    noGoals = goalCount === 0
  }

  if (!noBudget && !noGoals) {
    return NextResponse.json({ skipped: true, reason: 'setup_complete' })
  }

  // ── Send email ─────────────────────────────────────────────────────────────
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const firstName = user.name?.split(' ')[0] ?? 'there'

  await sendSetupNudgeEmail({
    firstName,
    email: user.email,
    noBudget,
    noGoals,
    monthName,
  })

  // ── Log to EmailLog ────────────────────────────────────────────────────────
  await db.collection<Omit<IEmailLog, '_id'>>('email_logs').insertOne({
    userId,
    type: 'setup_nudge',
    sentAt: now,
  } as unknown as Omit<IEmailLog, '_id'>)

  return NextResponse.json({ sent: true, noBudget, noGoals })
}
