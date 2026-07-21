import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { IAnnouncement } from '@/lib/models/Announcement'
import type { IAnnouncementView, AnnouncementViewSource } from '@/lib/models/AnnouncementView'

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const VALID_SOURCES: AnnouncementViewSource[] = ['carousel']

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key } = await params
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: 'Invalid announcement key' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const source = body.source
  const position = body.position
  const dismissed = body.dismissed === true

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
    return NextResponse.json({ error: 'position must be a non-negative integer' }, { status: 400 })
  }

  const db = await getDb()

  // Confirm the announcement exists and is currently active before writing a view record -
  // otherwise a crafted request can seed rows for arbitrary or inactive keys and pollute
  // the analytics in PRD §11.
  const now = new Date()
  const announcement = await db.collection<IAnnouncement>('announcements').findOne({
    key,
    isActive: true,
    publishedAt: { $lte: now },
    expiresAt: { $gt: now },
  })
  if (!announcement) {
    return NextResponse.json({ error: 'Announcement not found or inactive' }, { status: 404 })
  }

  const col = db.collection<IAnnouncementView>('announcementViews')
  const userId = session.user.id

  const existing = await col.findOne({ userId, announcementKey: key })

  if (!existing) {
    try {
      await col.insertOne({
        _id: new ObjectId(),
        userId,
        announcementKey: key,
        seenAt: now,
        dismissedAt: dismissed ? now : null,
        source,
        position,
        createdAt: now,
      })
    } catch (err) {
      // Unique-index race: another request inserted first between our findOne and insertOne.
      // Fall through to the update path below rather than erroring the client.
      if (!(err instanceof Error) || !err.message.includes('E11000')) throw err
      if (dismissed) {
        await col.updateOne(
          { userId, announcementKey: key, dismissedAt: null },
          { $set: { dismissedAt: now } }
        )
      }
    }
  } else if (dismissed && !existing.dismissedAt) {
    // $setOnInsert-equivalent guard: never overwrite an already-set dismissedAt, which
    // would reset the time-to-dismiss metric on a repeat view of the same card.
    await col.updateOne({ _id: existing._id }, { $set: { dismissedAt: now } })
  }

  return NextResponse.json({ ok: true })
}
