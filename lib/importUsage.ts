import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export { FREE_IMPORT_LIMIT, PREMIUM_IMPORT_LIMIT } from '@/lib/constants'

function nextMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
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

export async function incrementImportCount(userId: string): Promise<void> {
  const db = await getDb()
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { 'importUsage.count': 1 } }
  )
}
