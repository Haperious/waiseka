import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { isPremium, historyWindowStart } from '@/lib/tier'
import type { ITransaction } from '@/lib/models/Transaction'
import type { IUser } from '@/lib/models/User'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))

  const db = await getDb()

  // -- Tier gate: free users cannot query beyond their history window
  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(session.user.id) as never })
  const userIsPremium = user ? isPremium(user) : false

  const requestedStart = new Date(Date.UTC(year, month - 1, 1))
  const requestedEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  let startDate: Date
  let endDate: Date

  if (!userIsPremium) {
    const freeWindowStart = historyWindowStart(false)

    if (requestedEnd < freeWindowStart) {
      return NextResponse.json({
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        netSavings: 0,
        savingsRate: 0,
        categoryBreakdown: [],
        restricted: true,
      })
    }

    startDate = requestedStart < freeWindowStart ? freeWindowStart : requestedStart
    endDate = requestedEnd
  } else {
    startDate = requestedStart
    endDate = requestedEnd
  }

  const col = db.collection<ITransaction>('transactions')

  // One pass over the month's transactions: totals and the expense-by-category breakdown
  const [facet] = await col.aggregate<{
    summary: { totalIncome: number; totalExpenses: number; totalSavings: number; netSavings: number; savingsRate: number }[]
    categoryBreakdown: { category: string; total: number; count: number }[]
  }>([
    {
      $match: {
        userId: session.user.id,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalIncome: {
                $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
              },
              totalExpenses: {
                $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
              },
              totalSavings: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$type', 'savings'] },
                        { $and: [{ $eq: ['$type', 'transfer'] }, { $eq: ['$countsAsSavings', true] }] },
                      ],
                    },
                    '$amount',
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalIncome: 1,
              totalExpenses: 1,
              totalSavings: 1,
              // Money actively set aside (explicit 'savings' transactions plus transfers
              // into a savings/time_deposit account) counts as savings on top of leftover
              // cash flow, so it's recognized even when it never shows up as an 'expense'.
              netSavings: {
                $add: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, '$totalSavings'],
              },
              savingsRate: {
                $cond: [
                  { $gt: ['$totalIncome', 0] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $add: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, '$totalSavings'] },
                          '$totalIncome',
                        ],
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],
        categoryBreakdown: [
          { $match: { type: 'expense' } },
          {
            $group: {
              _id: '$category',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
          {
            $project: {
              _id: 0,
              category: '$_id',
              total: 1,
              count: 1,
            },
          },
        ],
      },
    },
  ]).toArray()

  const summary = facet?.summary[0]
  const categoryBreakdown = facet?.categoryBreakdown ?? []

  const totalExpenses = summary?.totalExpenses ?? 0
  const categoryWithPercent = categoryBreakdown.map((c) => ({
    ...c,
    percentage: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0,
  }))

  return NextResponse.json({
    totalIncome: summary?.totalIncome ?? 0,
    totalExpenses: summary?.totalExpenses ?? 0,
    totalSavings: summary?.totalSavings ?? 0,
    netSavings: summary?.netSavings ?? 0,
    savingsRate: summary?.savingsRate ? Math.round(summary.savingsRate) : 0,
    categoryBreakdown: categoryWithPercent,
  })
}
