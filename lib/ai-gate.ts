import { NextResponse } from 'next/server'
import { isPremium } from '@/lib/tier'
import type { IGlobalSettings } from '@/lib/models/GlobalSettings'
import type { IUser } from '@/lib/models/User'

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

  const cap = user.ai.queriesCapOverride ?? settings.aiQueryCap
  if (user.ai.queriesUsed >= cap) {
    const resetDate = user.ai.resetDate
      ? new Date(user.ai.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'next month'
    return NextResponse.json(
      { error: `Monthly AI query limit reached. Resets on ${resetDate}` },
      { status: 403 }
    )
  }

  return null
}
