import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { getSettings } from '@/lib/models/GlobalSettings'
import { adminGate } from '@/lib/admin-gate'
import type { IGlobalSettings } from '@/lib/models/GlobalSettings'

export async function GET() {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  try { adminGate(session) } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const update: Record<string, unknown> = { updatedBy: session!.user.email, updatedAt: new Date() }

  if (body.aiEnabled !== undefined) update.aiEnabled = body.aiEnabled
  if (body.aiQueryCap !== undefined) update.aiQueryCap = body.aiQueryCap
  if (body.notificationsEnabled !== undefined) update.notificationsEnabled = body.notificationsEnabled
  if (body.maintenanceMode !== undefined) update.maintenanceMode = body.maintenanceMode

  const db = await getDb()
  const col = db.collection<IGlobalSettings>('globalsettings')
  await col.updateOne({}, { $set: update }, { upsert: true })

  const settings = await col.findOne({})
  return NextResponse.json(settings)
}
