import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import type { IAnnouncement } from '@/lib/models/Announcement'
import type { IUser } from '@/lib/models/User'
import { isPremium } from '@/lib/tier'
import { MAX_PENDING_ANNOUNCEMENTS } from '@/lib/constants'

export async function GET() {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()

  // Tier read fresh from the DB, not the (potentially weeks-stale) JWT session - a user
  // who upgrades to premium must see premium announcements without re-authenticating.
  const dbUser = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { tier: 1, premiumOverride: 1 } }
  )
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveTier = isPremium(dbUser) ? 'premium' : 'free'
  const now = new Date()
  const accountCreatedAt = new Date(session.user.createdAt)

  const announcements = await db
    .collection<IAnnouncement>('announcements')
    .aggregate([
      {
        $match: {
          isActive: true,
          publishedAt: { $lte: now, $gte: accountCreatedAt },
          expiresAt: { $gt: now },
          $or: [{ targetTier: 'all' }, { targetTier: effectiveTier }],
        },
      },
      {
        $lookup: {
          from: 'announcementViews',
          let: { key: '$key' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', session.user.id] },
                    { $eq: ['$announcementKey', '$$key'] },
                  ],
                },
              },
            },
          ],
          as: 'views',
        },
      },
      { $match: { views: { $size: 0 } } },
      { $sort: { priority: -1, publishedAt: -1 } },
      { $limit: MAX_PENDING_ANNOUNCEMENTS },
      {
        $project: {
          _id: 0,
          key: 1,
          title: 1,
          description: 1,
          imagePath: 1,
          imageAlt: 1,
          ctaLabel: 1,
          ctaHref: 1,
        },
      },
    ])
    .toArray()

  return NextResponse.json({ announcements })
}
