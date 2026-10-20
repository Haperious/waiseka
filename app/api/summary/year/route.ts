/*
 * GET /api/summary/year?year=2025&currency=PHP
 *
 * Premium only. Backs the /reports "Full year" range: 12 months of totals, per-category
 * monthly spend, year totals and the years the picker can offer. Defaults to this year;
 * the year must fall inside the user's history window (400 otherwise).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { buildYearReport } from '@/lib/services/yearReport'
import { parseReportYear } from '@/lib/reportYears'
import { getReportViewer, PREMIUM_REPORT_ERROR } from '@/lib/services/reportViewer'

export async function GET(req: NextRequest) {
  const session = await requireVerifiedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const { premium, scope } = await getReportViewer(db, session.user.id, req)
  if (!premium) return NextResponse.json({ error: PREMIUM_REPORT_ERROR }, { status: 403 })

  const now = new Date()
  const parsed = parseReportYear(req.nextUrl.searchParams.get('year'), premium, now, 'fy')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const report = await buildYearReport(db, session.user.id, parsed.year, premium, scope, now)
  return NextResponse.json(report)
}
