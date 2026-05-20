import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import Transaction from '@/lib/models/Transaction'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  await connectDB()

  const [summary] = await Transaction.aggregate([
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
      },
    },
    {
      $project: {
        _id: 0,
        totalIncome: 1,
        totalExpenses: 1,
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
  ])

  const categoryBreakdown = await Transaction.aggregate([
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
  ])

  const totalExpenses = summary?.totalExpenses ?? 0
  const categoryWithPercent = categoryBreakdown.map((c) => ({
    ...c,
    percentage: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0,
  }))

  return NextResponse.json({
    totalIncome: summary?.totalIncome ?? 0,
    totalExpenses: summary?.totalExpenses ?? 0,
    netSavings: summary?.netSavings ?? 0,
    savingsRate: summary?.savingsRate ? Math.round(summary.savingsRate) : 0,
    categoryBreakdown: categoryWithPercent,
  })
}
