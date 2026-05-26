import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const db = await getDb()
  const col = db.collection<ITransaction>('transactions')

  const [summary] = await col.aggregate([
    {
      $match: {
        userId: session.user.id,
        date: { $gte: startDate, $lte: endDate },
      },
    },
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
          $sum: { $cond: [{ $eq: ['$type', 'savings'] }, '$amount', 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalIncome: 1,
        totalExpenses: 1,
        totalSavings: 1,
        netSavings: { $subtract: ['$totalIncome', '$totalExpenses'] },
        savingsRate: {
          $cond: [
            { $gt: ['$totalIncome', 0] },
            {
              $multiply: [
                { $divide: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, '$totalIncome'] },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
  ]).toArray()

  const categoryBreakdown = await col.aggregate([
    {
      $match: {
        userId: session.user.id,
        type: 'expense',
        date: { $gte: startDate, $lte: endDate },
      },
    },
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
  ]).toArray()

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
