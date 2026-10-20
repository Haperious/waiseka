import { NextResponse } from 'next/server'
import type { Db } from 'mongodb'
import { isPremium } from '@/lib/tier'
import type { IGlobalSettings } from '@/lib/models/GlobalSettings'
import type { IUser } from '@/lib/models/User'

export function aiQueryCap(user: IUser, settings: IGlobalSettings): number {
  return user.ai.queriesCapOverride ?? settings.aiQueryCap
}

function queryLimitResponse(user: IUser): NextResponse {
  const resetDate = user.ai.resetDate
    ? new Date(user.ai.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'next month'
  return NextResponse.json(
    { error: `Monthly AI query limit reached. Resets on ${resetDate}` },
    { status: 403 }
  )
}

export function aiGate(
  user: IUser,
  settings: IGlobalSettings
): NextResponse | null {
  if (!settings.aiEnabled) {
    return NextResponse.json(
      { error: 'AI features are currently unavailable' },
      { status: 403 }
    )
  }

  if (!user.ai.enabled) {
    return NextResponse.json(
      { error: 'AI features are disabled for your account' },
      { status: 403 }
    )
  }

  if (!isPremium(user)) {
    return NextResponse.json(
      { error: 'AI analysis requires a Premium subscription' },
      { status: 403 }
    )
  }

  if (user.ai.queriesUsed >= aiQueryCap(user, settings)) return queryLimitResponse(user)

  return null
}

/**
 * Runs one AI call against the user's monthly cap. The query is taken with a conditional
 * $inc before the call - aiGate's read-then-check alone lets parallel requests all pass on
 * the same count - and given back if the call throws, so an Anthropic outage costs nothing.
 * Returns the call's result with the new count, or the limit response when the cap is used up.
 */
export async function withAiQuery<T>(
  db: Db,
  user: IUser,
  settings: IGlobalSettings,
  run: () => Promise<T>
): Promise<{ result: T; queriesUsed: number } | NextResponse> {
  const users = db.collection<IUser>('users')
  const reserved = await users.findOneAndUpdate(
    { _id: user._id, 'ai.queriesUsed': { $lt: aiQueryCap(user, settings) } },
    { $inc: { 'ai.queriesUsed': 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after', projection: { 'ai.queriesUsed': 1 } }
  )
  if (!reserved) return queryLimitResponse(user)

  try {
    return { result: await run(), queriesUsed: reserved.ai.queriesUsed }
  } catch (err) {
    await users.updateOne(
      { _id: user._id, 'ai.queriesUsed': { $gt: 0 } },
      { $inc: { 'ai.queriesUsed': -1 } }
    ).catch((releaseErr) => console.error('[ai-gate] failed to give back AI query', releaseErr))
    throw err
  }
}
