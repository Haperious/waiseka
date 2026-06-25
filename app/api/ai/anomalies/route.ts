/*
 * GET /api/ai/anomalies
 *
 * Problem: Users don't know when a spending category has spiked significantly
 *          compared to their own history. They only notice after the damage is done.
 *
 * Success criteria: Returns flagged categories where current-month spend is >150%
 *                   of the rolling average of prior months. Requires at least 2 prior
 *                   months of data per category before flagging- no false positives
 *                   for new users.
 *
 * Scope: Pure arithmetic aggregation- no AI call, no new models, no tier gate.
 * Out of scope: Push/email notifications, historical anomaly log, per-transaction drill-down.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDb } from '@/lib/mongodb'
import type { ITransaction } from '@/lib/models/Transaction'

const ANOMALY_THRESHOLD = 1.5   // flag when current > avg * 1.5
const MIN_PRIOR_MONTHS  = 2     // minimum prior months needed to establish a baseline
const LOOKBACK_MONTHS   = 3     // how many prior months to average

export interface AnomalyItem {
  category: string
  currentAmount: number
  averageAmount: number
  percentageAbove: number
  monthsOfData: number
}

export interface AnomalyResponse {
  anomalies: AnomalyItem[]
  insufficientData: boolean
}

export async function GET(): Promise<NextResponse<AnomalyResponse>> {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ anomalies: [], insufficientData: false }, { status: 401 })
  }

  const db = await getDb()
  const col = db.collection<ITransaction>('transactions')
  const now = new Date()

  // ── Build month boundaries ────────────────────────────────────────────────
  // Current month: [currentStart, currentEnd]
  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const currentEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  // Prior months: go back LOOKBACK_MONTHS months before the current month
  const priorStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - LOOKBACK_MONTHS, 1))
  const priorEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999))

  // ── Aggregate current month by category ──────────────────────────────────
  const currentRaw = await col.aggregate<{ category: string; total: number }>([
    {
      $match: {
        userId: session.user.id,
        type: 'expense',
        isArchived: { $ne: true },
        date: { $gte: currentStart, $lte: currentEnd },
      },
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $project: { _id: 0, category: '$_id', total: 1 } },
  ]).toArray()

  if (currentRaw.length === 0) {
    return NextResponse.json({ anomalies: [], insufficientData: false })
  }

  // ── Aggregate prior months by category + month ────────────────────────────
  // We need per-month totals so we can count distinct months per category.
  const priorRaw = await col.aggregate<{ category: string; yearMonth: string; total: number }>([
    {
      $match: {
        userId: session.user.id,
        type: 'expense',
        isArchived: { $ne: true },
        date: { $gte: priorStart, $lte: priorEnd },
      },
    },
    {
      $group: {
        _id: {
          category: '$category',
          year:  { $year:  '$date' },
          month: { $month: '$date' },
        },
        total: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id.category',
        yearMonth: {
          $concat: [
            { $toString: '$_id.year' }, '-',
            { $toString: '$_id.month' },
          ],
        },
        total: 1,
      },
    },
  ]).toArray()

  // ── Check overall data sufficiency ────────────────────────────────────────
  // Count distinct prior months across ALL categories
  const allPriorMonths = new Set(priorRaw.map((r) => r.yearMonth))
  if (allPriorMonths.size < MIN_PRIOR_MONTHS) {
    return NextResponse.json({ anomalies: [], insufficientData: true })
  }

  // ── Build per-category prior month map ───────────────────────────────────
  const priorByCategory: Record<string, number[]> = {}
  for (const row of priorRaw) {
    if (!priorByCategory[row.category]) priorByCategory[row.category] = []
    priorByCategory[row.category].push(row.total)
  }

  // ── Detect anomalies ─────────────────────────────────────────────────────
  const anomalies: AnomalyItem[] = []

  for (const { category, total: currentAmount } of currentRaw) {
    const priorMonths = priorByCategory[category]

    // Skip categories without enough prior history
    if (!priorMonths || priorMonths.length < MIN_PRIOR_MONTHS) continue

    const averageAmount = priorMonths.reduce((sum, v) => sum + v, 0) / priorMonths.length

    // Can't compare against a zero baseline
    if (averageAmount <= 0) continue

    if (currentAmount > averageAmount * ANOMALY_THRESHOLD) {
      anomalies.push({
        category,
        currentAmount: Math.round(currentAmount * 100) / 100,
        averageAmount: Math.round(averageAmount * 100) / 100,
        percentageAbove: Math.round((currentAmount / averageAmount - 1) * 100),
        monthsOfData: priorMonths.length,
      })
    }
  }

  // Sort by most extreme anomaly first
  anomalies.sort((a, b) => b.percentageAbove - a.percentageAbove)

  return NextResponse.json({ anomalies, insufficientData: false })
}
