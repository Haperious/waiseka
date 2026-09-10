/*
 * GET /api/summary/export?format=csv
 *
 * CSV export of the same 3-month report data as /api/summary/range, for the
 * /reports page's Export button. CSV only for v1 - PDF is a later fast-follow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildRangeReport, monthsBack } from '@/lib/services/monthlyStats'

const RANGE_MONTHS = 3

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'csv'
  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format - only "csv" is available' }, { status: 400 })
  }

  const db = await getDb()
  const months = monthsBack(new Date(), RANGE_MONTHS)
  const report = await buildRangeReport(db, session.user.id, months)

  const monthLabels = report.months.map((m) => m.label)

  const summaryHeader = ['Metric', ...monthLabels, 'Total']
  const summaryRows: string[][] = [
    ['Income', ...report.months.map((m) => m.income), report.totals.income],
    ['Expenses', ...report.months.map((m) => m.expenses), report.totals.expenses],
    ['Savings', ...report.months.map((m) => m.savings), report.totals.savings],
    ['Leftover', ...report.months.map((m) => m.leftover), report.totals.leftover],
    ['Savings Rate %', ...report.months.map((m) => m.savingsRate), report.totals.savingsRate],
  ].map((row) => row.map((v) => escapeCsvField(v as string | number)))

  const categoryHeader = ['Category', ...monthLabels, '3-mo Avg', 'vs Avg %']
  const categoryRows = report.categories.map((c) =>
    [c.name, ...c.byMonth, Math.round(c.average * 100) / 100, c.currentVsAverage].map((v) =>
      escapeCsvField(v as string | number)
    )
  )

  const csv = [
    summaryHeader.join(','),
    ...summaryRows.map((r) => r.join(',')),
    '',
    categoryHeader.join(','),
    ...categoryRows.map((r) => r.join(',')),
  ].join('\n')

  const from = report.months[0].label
  const to = report.months[report.months.length - 1].label

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="waiseka-report-${from}-${to}.csv"`,
    },
  })
}
