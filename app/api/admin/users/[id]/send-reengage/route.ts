import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { adminGate } from '@/lib/admin-gate'
import { sendReEngageEmail } from '@/lib/email'
import type { IUser } from '@/lib/models/User'
import type { IGoal } from '@/lib/models/Goal'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n: number, sym: string) {
  return `${sym}${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const { id } = await params

  const db = await getDb()
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(id) },
    { projection: { name: 1, email: 1, preferences: 1, notifications: 1 } }
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now = new Date()
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  const daysRemaining = monthEnd.getUTCDate() - now.getUTCDate()
  const monthName = MONTH_NAMES[now.getMonth()]
  const sym = user.preferences?.currencySymbol ?? '₱'

  const lastSeen = user.notifications?.lastSeen ? new Date(user.notifications.lastSeen) : null
  const daysSinceLogin = lastSeen
    ? Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const userId = user._id.toString()
  const topGoal = await db.collection<IGoal>('goals')
    .find({ userId, status: 'active' })
    .sort({ savedAmount: -1 })
    .limit(1)
    .next()

  // Use a placeholder goal message if user has no active goals
  const goalName = topGoal?.title ?? 'your savings goal'
  const goalPercent = topGoal && topGoal.targetAmount > 0
    ? Math.round((topGoal.savedAmount / topGoal.targetAmount) * 100)
    : 0
  const goalTarget = topGoal ? fmt(topGoal.targetAmount, sym) : fmt(0, sym)

  try {
    await sendReEngageEmail({
      firstName: user.name.split(' ')[0],
      email: user.email,
      daysSinceLogin,
      monthName,
      daysRemaining,
      topGoalName: goalName,
      topGoalPercent: goalPercent,
      topGoalTarget: goalTarget,
    })

    await db.collection<IUser>('users').updateOne(
      { _id: user._id },
      { $set: { 'notifications.email.lastSentReEngage': new Date() } }
    )

    return NextResponse.json({ ok: true, sentTo: user.email })
  } catch (err) {
    console.error('[admin] manual re-engage email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
