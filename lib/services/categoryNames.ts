import { ObjectId, type Db } from 'mongodb'
import type { ICategory } from '@/lib/models/Category'
import type { IUser } from '@/lib/models/User'
import { escapeRegex } from '@/lib/security'

/*
 * Transactions, budgets and voice keywords point at a category by its name, so the name
 * is what has to stay unique and what a rename has to carry along.
 */

export const MAX_CATEGORY_NAME = 50

/** Another of the user's categories with this name, ignoring upper/lower case ("Food" vs "food"). */
export function findCategoryNamed(db: Db, userId: string, name: string, excludeId?: ObjectId) {
  return db.collection<ICategory>('categories').findOne({
    userId,
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
}

/**
 * Moves everything filed under `from` to `to`. Without this, renaming "Food" left every
 * past entry and the Food budget on the old name: the budget stopped counting new spending
 * and reports showed the category twice.
 */
export async function renameCategoryEverywhere(db: Db, userId: string, from: string, to: string) {
  if (from === to) return
  await Promise.all([
    db.collection('transactions').updateMany(
      // Transfers and balance adjustments carry fixed category labels of their own
      { userId, category: from, type: { $in: ['income', 'expense', 'savings'] } },
      { $set: { category: to } },
    ),
    db.collection('budgets').updateMany({ userId, category: from }, { $set: { category: to } }),
    renameInVoiceKeywords(db, userId, from, to),
  ])
}

async function renameInVoiceKeywords(db: Db, userId: string, from: string, to: string) {
  const users = db.collection<IUser>('users')
  const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { 'preferences.voiceKeywords': 1 } })
  const keywords = user?.preferences?.voiceKeywords
  if (!keywords?.some((k) => k.category === from)) return
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { 'preferences.voiceKeywords': keywords.map((k) => (k.category === from ? { ...k, category: to } : k)) } },
  )
}

/**
 * Removes exact-name duplicates, keeping the oldest. Two first visits at once (several
 * dashboard widgets load categories together) used to seed the defaults twice.
 */
export async function dropDuplicateCategories(db: Db, categories: ICategory[]): Promise<ICategory[]> {
  const kept = new Map<string, ICategory>()
  const extra: ObjectId[] = []
  const oldestFirst = [...categories].sort((a, b) => a._id.toHexString().localeCompare(b._id.toHexString()))
  for (const c of oldestFirst) {
    if (kept.has(c.name)) extra.push(c._id)
    else kept.set(c.name, c)
  }
  if (extra.length === 0) return categories
  await db.collection<ICategory>('categories').deleteMany({ _id: { $in: extra } })
  return categories.filter((c) => !extra.some((id) => id.equals(c._id)))
}
