import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { getMonthlyImportCount } from '@/lib/importUsage'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'

const FREE_IMPORT_LIMIT = 5

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (isPremium({ tier: user.tier, premiumOverride: user.premiumOverride })) {
    return NextResponse.json({ count: null, limit: null, resetAt: null })
  }

  const count = await getMonthlyImportCount(userId)
  const resetAt = user.importUsage?.resetAt ?? null

  return NextResponse.json({ count, limit: FREE_IMPORT_LIMIT, resetAt })
}
