import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export { FREE_IMPORT_LIMIT, PREMIUM_IMPORT_LIMIT } from '@/lib/constants'

/** 1st of next month, UTC midnight - the same calendar the reports and history window use. */
function nextMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

export async function getMonthlyImportCount(userId: string): Promise<number> {
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) return 0

  const now = new Date()
  const resetAt = user.importUsage?.resetAt ? new Date(user.importUsage.resetAt) : null

  if (!resetAt || resetAt <= now) {
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'importUsage.count': 0, 'importUsage.resetAt': nextMonthStart() } }
    )
    return 0
  }

  return user.importUsage?.count ?? 0
}

/**
 * Take one import from this month's allowance when a file is uploaded - the upload is the
 * step that costs money (Claude / Textract), so that's what the limit has to count. The
 * conditional $inc keeps parallel uploads from going past the limit. False when used up.
 */
export async function reserveImport(userId: string, limit: number): Promise<boolean> {
  // Rolls the count over first when a new month has started
  await getMonthlyImportCount(userId)
  const db = await getDb()
  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(userId), 'importUsage.count': { $lt: limit } },
    { $inc: { 'importUsage.count': 1 } }
  )
  return result.modifiedCount === 1
}

/** Give back a reserved import, for uploads that stop before any extraction ran. */
export async function releaseImport(userId: string): Promise<void> {
  const db = await getDb()
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId), 'importUsage.count': { $gt: 0 } },
    { $inc: { 'importUsage.count': -1 } }
  )
}
