/*
 * GET /api/summary/export?format=csv&range=3m|fy|yoy&year=2025&currency=PHP
 *
 * CSV export for the /reports page's Download button, matching whichever range is on
 * screen: the last 3 months (everyone, the default), a full year or year-on-year
 * (Premium only - 403 otherwise; `year` is validated like the matching report route).
 * CSV only for v1 - PDF is a later fast-follow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildRangeReport, monthsBack } from '@/lib/services/monthlyStats'
import { buildYearReport, buildYoyReport } from '@/lib/services/yearReport'
import { parseReportYear } from '@/lib/reportYears'
import { getReportViewer, PREMIUM_REPORT_ERROR } from '@/lib/services/reportViewer'
import { rangeReportCsv, yearReportCsv, yoyReportCsv } from '@/lib/services/reportCsv'

const RANGE_MONTHS = 3

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const format = searchParams.get('format') ?? 'csv'
  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format - only "csv" is available' }, { status: 400 })
  }
  const range = searchParams.get('range') ?? '3m'
  if (range !== '3m' && range !== 'fy' && range !== 'yoy') {
    return NextResponse.json({ error: 'range must be 3m, fy, or yoy' }, { status: 400 })
  }

  const db = await getDb()
  const { premium, currency, scope } = await getReportViewer(db, session.user.id, req)
  const now = new Date()

  if (range === '3m') {
    const report = await buildRangeReport(db, session.user.id, monthsBack(now, RANGE_MONTHS), scope)
    const from = report.months[0].label
    const to = report.months[report.months.length - 1].label
    return csvResponse(rangeReportCsv(report, currency), `waiseka-report-${currency}-${from}-${to}.csv`)
  }

  if (!premium) return NextResponse.json({ error: PREMIUM_REPORT_ERROR }, { status: 403 })

  const parsed = parseReportYear(searchParams.get('year'), premium, now, range)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (range === 'fy') {
    const report = await buildYearReport(db, session.user.id, parsed.year, premium, scope, now)
    return csvResponse(yearReportCsv(report, currency), `waiseka-report-${currency}-${parsed.year}.csv`)
  }

  const report = await buildYoyReport(db, session.user.id, parsed.year, premium, scope, now)
  return csvResponse(
    yoyReportCsv(report, currency),
    `waiseka-report-${currency}-${report.previousYear}-vs-${report.year}.csv`
  )
}
