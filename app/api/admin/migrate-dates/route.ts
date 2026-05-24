import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'

// One-time migration: fix transaction dates stored as strings → Date objects
export async function POST() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const col = db.collection('transactions')

  // Find all transactions where date is a string (BSON type 2)
  const stringDates = await col.find({ date: { $type: 'string' } }).toArray()

  let fixed = 0
  let failed = 0

  for (const tx of stringDates) {
    const parsed = new Date(tx.date)
    if (isNaN(parsed.getTime())) {
      failed++
      continue
    }
    await col.updateOne({ _id: tx._id }, { $set: { date: parsed } })
    fixed++
  }

  return NextResponse.json({ fixed, failed, total: stringDates.length })
}
