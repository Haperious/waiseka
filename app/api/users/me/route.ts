import { NextRequest, NextResponse } from 'next/server'
import { badRequest, cleanText, readJsonBody } from '@/lib/request'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IUser, OnboardingStepId } from '@/lib/models/User'

const ONBOARDING_STEPS: OnboardingStepId[] = [
  'accounts',
  'dashboard',
  'transactions',
  'categories',
  'goals',
  'reports',
]

const MAX_NAME_LENGTH = 100
const MAX_AVATAR_URL_LENGTH = 500

/** An absolute http(s) link - anything else (javascript:, data:, a bare word) is refused. */
function isAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length > MAX_AVATAR_URL_LENGTH) return false
  try {
    const { protocol } = new URL(value.trim())
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const EXCLUDE = {
  password: 0,
  __v: 0,
  'ai.conversations': 0,
  'mfa.secret': 0,
  'mfa.backupCodes': 0,
  'notifications.push.fcmToken': 0,
}

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: EXCLUDE })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PUT(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
  const { name, avatar } = body

  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) {
    // Same limit as sign-up (api/auth/register)
    const cleaned = cleanText(name, MAX_NAME_LENGTH)
    if (!cleaned) return badRequest(`Name is required (up to ${MAX_NAME_LENGTH} characters)`)
    update.name = cleaned
  }
  if (avatar !== undefined) {
    if (avatar === null || avatar === '') update.avatar = null
    else if (isAvatarUrl(avatar)) update.avatar = avatar.trim()
    else return badRequest('Avatar must be an http(s) link of up to 500 characters')
  }

  const db = await getDb()

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
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body
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
