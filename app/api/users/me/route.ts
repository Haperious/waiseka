import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IUser, OnboardingStepId } from '@/lib/models/User'

const ONBOARDING_STEPS: OnboardingStepId[] = [
  'dashboard',
  'transactions',
  'categories',
  'goals',
]

const EXCLUDE = { password: 0, __v: 0, 'ai.conversations': 0 }

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: EXCLUDE })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, avatar } = body

  const db = await getDb()
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (name) update.name = name
  if (avatar !== undefined) update.avatar = avatar

  const user = await db
    .collection<IUser>('users')
    .findOneAndUpdate(
      { _id: new ObjectId(session.user.id) },
      { $set: update },
      { returnDocument: 'after', projection: EXCLUDE }
    )

  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { stepCompleted, dismissed } = body as {
    stepCompleted?: OnboardingStepId
    dismissed?: boolean
  }

  if (stepCompleted && !ONBOARDING_STEPS.includes(stepCompleted)) {
    return NextResponse.json({ error: 'Invalid onboarding step' }, { status: 400 })
  }

  const db = await getDb()
  const userId = new ObjectId(session.user.id)

  if (dismissed === true) {
    const user = await db.collection<IUser>('users').findOneAndUpdate(
      { _id: userId },
      { $set: { 'onboarding.dismissed': true, updatedAt: new Date() } },
      { returnDocument: 'after', projection: EXCLUDE }
    )
    return NextResponse.json(user)
  }

  if (stepCompleted) {
    // addToSet prevents duplicates
    await db.collection<IUser>('users').updateOne(
      { _id: userId },
      {
        $addToSet: { 'onboarding.stepsCompleted': stepCompleted },
        $set: { updatedAt: new Date() },
      }
    )

    // Re-fetch to check if all steps are now complete
    const updated = await db
      .collection<IUser>('users')
      .findOne({ _id: userId }, { projection: { 'onboarding.stepsCompleted': 1 } })

    const completed = updated?.onboarding?.stepsCompleted ?? []
    const allDone = ONBOARDING_STEPS.every((s) => completed.includes(s))

    if (allDone) {
      await db.collection<IUser>('users').updateOne(
        { _id: userId },
        { $set: { 'onboarding.completedAt': new Date(), updatedAt: new Date() } }
      )
    }

    const user = await db
      .collection<IUser>('users')
      .findOne({ _id: userId }, { projection: EXCLUDE })
    return NextResponse.json(user)
  }

  return NextResponse.json({ error: 'No valid onboarding action provided' }, { status: 400 })
}
