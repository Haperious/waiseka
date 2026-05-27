import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { incrementImportCount } from '@/lib/importUsage'
import { NextRequest, NextResponse } from 'next/server'
import type { ITransaction } from '@/lib/models/Transaction'
import { ObjectId } from 'mongodb'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { transactions } = (await req.json()) as { transactions: Partial<ITransaction>[] }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 })
  }

  const db = await getDb()

  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  const userIsPremium = user ? isPremium({ tier: user.tier, premiumOverride: user.premiumOverride }) : false

  const now = new Date()

  const docs = transactions.map((t) => ({
    userId,
    amount: t.amount ?? 0,
    type: t.type ?? 'expense',
    category: t.category ?? 'Others',
    description: t.description ?? '',
    date: t.date ? new Date(t.date as unknown as string) : now,
    tags: t.tags ?? [],
    isRecurring: t.isRecurring ?? false,
    source: 'import',
    createdAt: now,
    updatedAt: now,
  }))

  const inserted: typeof docs = []

  for (const doc of docs) {
    const exists = await db.collection('transactions').findOne({
      userId: doc.userId,
      date: doc.date,
      amount: doc.amount,
      description: doc.description,
    })
    if (!exists) inserted.push(doc)
  }

  if (inserted.length > 0) {
    await db.collection('transactions').insertMany(inserted)
  }

  if (!userIsPremium) {
    await incrementImportCount(userId)
  }

  return NextResponse.json({ inserted: inserted.length, skipped: docs.length - inserted.length })
}
