import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(session.user.id) }, { projection: { 'mfa.enabled': 1, 'mfa.enabledAt': 1, 'mfa.backupCodes': 1 } })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    enabled: user.mfa?.enabled ?? false,
    enabledAt: user.mfa?.enabledAt ?? null,
    backupCodesRemaining: user.mfa?.backupCodes?.length ?? 0,
  })
}
