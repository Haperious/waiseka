import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { getMonthlyImportCount } from '@/lib/importUsage'
import { FREE_IMPORT_LIMIT, PREMIUM_IMPORT_LIMIT } from '@/lib/constants'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const premium = isPremium({ tier: user.tier, premiumOverride: user.premiumOverride })
  const count = await getMonthlyImportCount(userId)
  const resetAt = user.importUsage?.resetAt ?? null

  return NextResponse.json({ count, limit: premium ? PREMIUM_IMPORT_LIMIT : FREE_IMPORT_LIMIT, resetAt })
}
