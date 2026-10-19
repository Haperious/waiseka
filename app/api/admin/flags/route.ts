import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { getSettings, invalidateSettingsCache } from '@/lib/models/GlobalSettings'
import type { IGlobalSettings } from '@/lib/models/GlobalSettings'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json()

  if (body.aiEnabled !== undefined && typeof body.aiEnabled !== 'boolean') {
    return NextResponse.json({ error: 'aiEnabled must be a boolean' }, { status: 400 })
  }
  if (body.aiQueryCap !== undefined && (typeof body.aiQueryCap !== 'number' || !Number.isFinite(body.aiQueryCap) || body.aiQueryCap < 0)) {
    return NextResponse.json({ error: 'aiQueryCap must be a non-negative number' }, { status: 400 })
  }
  if (body.notificationsEnabled !== undefined && typeof body.notificationsEnabled !== 'boolean') {
    return NextResponse.json({ error: 'notificationsEnabled must be a boolean' }, { status: 400 })
  }
  if (body.maintenanceMode !== undefined && typeof body.maintenanceMode !== 'boolean') {
    return NextResponse.json({ error: 'maintenanceMode must be a boolean' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updatedBy: session.user.email, updatedAt: new Date() }
  if (body.aiEnabled !== undefined) update.aiEnabled = body.aiEnabled
  if (body.aiQueryCap !== undefined) update.aiQueryCap = body.aiQueryCap
  if (body.notificationsEnabled !== undefined) update.notificationsEnabled = body.notificationsEnabled
  if (body.maintenanceMode !== undefined) update.maintenanceMode = body.maintenanceMode

  const db = await getDb()
  const col = db.collection<IGlobalSettings>('globalsettings')
  const settings = await col.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, returnDocument: 'after' }
  )
  invalidateSettingsCache()

  return NextResponse.json(settings)
}
