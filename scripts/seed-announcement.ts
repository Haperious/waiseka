/**
 * Seed one announcement into the `announcements` collection from a JSON file.
 *
 * INPUT JSON (see scripts/announcements/*.json for examples):
 *   {
 *     "key": "kebab-case-unique-id",
 *     "title": "...",                 // <= ANNOUNCEMENT_TITLE_MAX_LENGTH
 *     "description": "...",           // <= ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH
 *     "imagePath": "/announcements/kebab-case-unique-id.png",
 *     "imageAlt": "...",
 *     "ctaLabel": "Try it now" | null,
 *     "ctaHref": "/some/route" | null,
 *     "targetTier": "all" | "free" | "premium",
 *     "priority": 0,                  // optional, default 0
 *     "publishedAt": "2026-09-14",    // optional, default now
 *     "expiresAt": "2026-10-14"       // optional, default publishedAt + ANNOUNCEMENT_DEFAULT_TTL_DAYS
 *   }
 *
 * The referenced image must already exist under public/<imagePath> - this script
 * does not generate or move images (see generate-announcement-image.py for that).
 *
 * SAFETY:
 * - Defaults to DRY RUN: validates and prints what would be written, no writes.
 * - Pass --execute to actually upsert into MongoDB.
 * - Upserts on `key`, so re-running with an edited JSON file updates the existing doc
 *   instead of creating a duplicate.
 *
 * RUN:
 *   Dry run:  npx tsx scripts/seed-announcement.ts scripts/announcements/my-key.json
 *   Real run: npx tsx scripts/seed-announcement.ts scripts/announcements/my-key.json --execute
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { ObjectId } from 'mongodb'
import { getDb } from '../lib/mongodb'
import type { IAnnouncement, AnnouncementTier } from '../lib/models/Announcement'
import {
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH,
  ANNOUNCEMENT_DEFAULT_TTL_DAYS,
} from '../lib/constants'

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const VALID_TIERS: AnnouncementTier[] = ['all', 'free', 'premium']

interface AnnouncementInput {
  key: string
  title: string
  description: string
  imagePath: string
  imageAlt: string
  ctaLabel?: string | null
  ctaHref?: string | null
  targetTier: AnnouncementTier
  priority?: number
  publishedAt?: string
  expiresAt?: string
}

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

async function main() {
  const isExecute = process.argv.includes('--execute')
  const jsonPath = process.argv.find((arg) => arg.endsWith('.json'))

  if (!jsonPath) {
    fail('Usage: npx tsx scripts/seed-announcement.ts <path-to-json> [--execute]')
  }

  if (!existsSync(jsonPath)) {
    fail(`File not found: ${jsonPath}`)
  }

  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8')) as AnnouncementInput

  if (!raw.key || !KEY_PATTERN.test(raw.key)) {
    fail(`"key" must be kebab-case (e.g. "multi-account-balance"), got: ${JSON.stringify(raw.key)}`)
  }
  if (!raw.title || raw.title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH) {
    fail(`"title" is required and must be <= ${ANNOUNCEMENT_TITLE_MAX_LENGTH} chars`)
  }
  if (!raw.description || raw.description.length > ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH) {
    fail(`"description" is required and must be <= ${ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH} chars`)
  }
  if (!raw.imagePath || !raw.imagePath.startsWith('/')) {
    fail('"imagePath" is required and must be an absolute path under public/ (e.g. "/announcements/foo.png")')
  }
  if (!raw.imageAlt) {
    fail('"imageAlt" is required for accessibility')
  }
  if (!raw.targetTier || !VALID_TIERS.includes(raw.targetTier)) {
    fail(`"targetTier" must be one of ${VALID_TIERS.join(', ')}`)
  }
  if ((raw.ctaLabel && !raw.ctaHref) || (!raw.ctaLabel && raw.ctaHref)) {
    fail('"ctaLabel" and "ctaHref" must both be set or both be null')
  }
  if (raw.ctaHref && !raw.ctaHref.startsWith('/')) {
    fail('"ctaHref" must be an internal app route (starting with "/")')
  }

  const imageOnDisk = join(process.cwd(), 'public', raw.imagePath)
  if (!existsSync(imageOnDisk)) {
    fail(`Image referenced by "imagePath" does not exist on disk: ${imageOnDisk}`)
  }

  const now = new Date()
  const publishedAt = raw.publishedAt ? new Date(raw.publishedAt) : now
  const expiresAt = raw.expiresAt
    ? new Date(raw.expiresAt)
    : new Date(publishedAt.getTime() + ANNOUNCEMENT_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000)

  if (Number.isNaN(publishedAt.getTime())) fail(`Invalid "publishedAt": ${raw.publishedAt}`)
  if (Number.isNaN(expiresAt.getTime())) fail(`Invalid "expiresAt": ${raw.expiresAt}`)
  if (expiresAt <= publishedAt) fail('"expiresAt" must be after "publishedAt"')

  const doc: Omit<IAnnouncement, '_id' | 'createdAt'> = {
    key: raw.key,
    title: raw.title,
    description: raw.description,
    imagePath: raw.imagePath,
    imageAlt: raw.imageAlt,
    ctaLabel: raw.ctaLabel ?? null,
    ctaHref: raw.ctaHref ?? null,
    publishedAt,
    expiresAt,
    isActive: true,
    priority: raw.priority ?? 0,
    targetTier: raw.targetTier,
    updatedAt: now,
  }

  console.log('Announcement to seed:')
  console.log(JSON.stringify({ ...doc, publishedAt: doc.publishedAt.toISOString(), expiresAt: doc.expiresAt.toISOString() }, null, 2))

  if (!isExecute) {
    console.log('\nDRY RUN - no writes performed. Re-run with --execute to upsert into MongoDB.')
    process.exit(0)
  }

  const db = await getDb()
  const col = db.collection<IAnnouncement>('announcements')

  const result = await col.updateOne(
    { key: raw.key },
    {
      $set: doc,
      $setOnInsert: { _id: new ObjectId(), createdAt: now },
    },
    { upsert: true }
  )

  if (result.upsertedCount > 0) {
    console.log(`\nInserted new announcement "${raw.key}".`)
  } else {
    console.log(`\nUpdated existing announcement "${raw.key}".`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
