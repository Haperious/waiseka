import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import { isPremium } from '@/lib/tier'
import { FREE_HISTORY_DAYS } from '@/lib/constants'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'
import type { ICategory } from '@/lib/models/Category'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TOP_CATEGORY_LIMIT = 6
// Fallback palette when a category has no stored color
const FALLBACK_COLORS = [
  '#166534', '#16A34A', '#4ADE80', '#84CC16',
  '#D97706', '#B45309', '#2563EB', '#7C3AED',
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))

  const db = await getDb()

  // -- Tier gate: clamp to free window for non-premium users
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

  let effectiveStart = yearStart
  if (!userIsPremium) {
    const freeWindowStart = new Date()
    freeWindowStart.setDate(freeWindowStart.getDate() - FREE_HISTORY_DAYS)
    freeWindowStart.setUTCHours(0, 0, 0, 0)
    if (freeWindowStart > yearStart) {
      effectiveStart = freeWindowStart
    }
  }

  // Aggregate expense transactions grouped by month and category
  const rows = await db.collection<ITransaction>('transactions').aggregate([
    {
      $match: {
        userId: session.user.id,
        type: 'expense',
        date: { $gte: effectiveStart, $lte: yearEnd },
      },
    },
    {
      $group: {
        _id: { month: { $month: '$date' }, category: '$category' },
        total: { $sum: '$amount' },
      },
    },
  ]).toArray()

  // Build a map: category -> month index (0-based) -> total
  const categoryMonthMap: Record<string, number[]> = {}
  const categoryAnnualTotal: Record<string, number> = {}

  for (const row of rows) {
    const cat   = row._id.category as string
    const month = (row._id.month as number) - 1  // convert to 0-based
    const total = row.total as number

    if (!categoryMonthMap[cat]) {
      categoryMonthMap[cat] = new Array(12).fill(0)
    }
    categoryMonthMap[cat][month] = total
    categoryAnnualTotal[cat] = (categoryAnnualTotal[cat] ?? 0) + total
  }

  // Skip categories with zero activity
  const activeCategories = Object.keys(categoryMonthMap).filter(
    (cat) => (categoryAnnualTotal[cat] ?? 0) > 0
  )

  if (activeCategories.length === 0) {
    return NextResponse.json({ months: MONTH_LABELS, categories: [], restricted: !userIsPremium })
  }

  // Sort by annual total desc, take top 6, bucket the rest into 'Other'
  const sorted = activeCategories.sort((a, b) => (categoryAnnualTotal[b] ?? 0) - (categoryAnnualTotal[a] ?? 0))
  const top    = sorted.slice(0, TOP_CATEGORY_LIMIT)
  const rest   = sorted.slice(TOP_CATEGORY_LIMIT)

  // Fetch stored colors from the categories collection
  const categoryDocs = await db.collection<ICategory>('categories')
    .find({ userId: session.user.id, name: { $in: top } })
    .project({ name: 1, color: 1 })
    .toArray()

  const colorMap: Record<string, string> = {}
  for (const doc of categoryDocs) {
    if (doc.color) colorMap[doc.name] = doc.color
  }

  const result = top.map((cat, i) => ({
    name:  cat,
    color: colorMap[cat] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    data:  categoryMonthMap[cat],
  }))

  // Aggregate the 'Other' bucket
  if (rest.length > 0) {
    const otherData = new Array(12).fill(0)
    for (const cat of rest) {
      for (let m = 0; m < 12; m++) {
        otherData[m] += categoryMonthMap[cat]?.[m] ?? 0
      }
    }
    result.push({ name: 'Other', color: '#94a3b8', data: otherData })
  }

  // For free users, zero out months outside the free window
  if (!userIsPremium) {
    const freeWindowStart = new Date()
    freeWindowStart.setDate(freeWindowStart.getDate() - FREE_HISTORY_DAYS)
    for (const cat of result) {
      for (let m = 0; m < 12; m++) {
        const monthEnd = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999))
        if (monthEnd < freeWindowStart) {
          cat.data[m] = 0
        }
      }
    }
  }

  return NextResponse.json({
    months: MONTH_LABELS,
    categories: result,
    restricted: !userIsPremium,
  })
}
