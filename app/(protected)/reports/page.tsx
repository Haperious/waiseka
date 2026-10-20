'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PieChart, Tags, Download } from 'lucide-react'
import { useViewCurrency } from '@/context/ViewCurrencyContext'
import ViewCurrencySwitcher from '@/components/ViewCurrencySwitcher'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePreferences } from '@/hooks/usePreferences'
import { extractApiError, useResource } from '@/hooks/useFetch'
import { formatAmountCompact, formatAmountWhole, getCurrencySymbol } from '@/lib/currency'
import { isPremium } from '@/lib/tier'
import { monthsCoveredIn, parseReportYear, selectableYears } from '@/lib/reportYears'
import type { RangeReport } from '@/lib/services/monthlyStats'
import type { AvailableYear, YearReport, YoyReport as YoyReportData } from '@/lib/services/yearReport'
import { RangeSwitcher, YearPicker } from './ReportControls'
import { EmptyYearCard, PlanFooter, PremiumLockCard, ReportError } from './ReportParts'
import { ReportBodySkeleton } from './ReportSkeleton'
import ThreeMonthReport from './ThreeMonthReport'
import FullYearReport from './FullYearReport'
import YoyReport from './YoyReport'
import { hasActivity, monthSpan, parseRange, type ReportRange, type ReportView } from './reportModel'
import styles from './reports.module.css'

/** What a Premium-only report route answers a free user with (403). */
interface Locked { locked: true }

const isLocked = (value: unknown): value is Locked =>
  typeof value === 'object' && value !== null && 'locked' in value

async function fetchReport<T>(url: string): Promise<T | Locked> {
  const res = await fetch(url)
  if (res.status === 403) return { locked: true }
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json() as Promise<T>
}

/** Fetches `url` (null = don't) through useResource, which drops stale responses. */
function useReport<T>(url: string | null) {
  const fetcher = useCallback(() => fetchReport<T>(url!), [url])
  return useResource(fetcher, { enabled: url !== null })
}

export default function ReportsPage() {
  const { viewCurrency } = useViewCurrency()
  const { preferences } = usePreferences()
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // One "now" for the page's lifetime, so the year list and labels can't shift mid-session
  const [now] = useState(() => new Date())
  const currentYear = now.getUTCFullYear()

  const viewParam = searchParams.get('view')
  const view: ReportView = viewParam === 'table' || viewParam === 'chart'
    ? viewParam
    : preferences?.reportsDefaultView ?? 'chart'
  const requestedRange = parseRange(searchParams.get('range'))
  const yearMode = requestedRange === 'yoy' ? 'yoy' : 'fy'
  // The URL may carry any year; one outside the Premium window falls back to this year
  const parsedYear = parseReportYear(searchParams.get('year'), true, now, yearMode)
  const year = parsedYear.ok ? parsedYear.year : currentYear

  const sessionReady = sessionStatus !== 'loading'
  const sessionPremium = session
    ? isPremium({ tier: session.user.tier, premiumOverride: session.user.premiumOverride })
    : false

  const currencyParam = `currency=${viewCurrency}`
  const fyUrl = sessionReady && sessionPremium && requestedRange === 'fy'
    ? `/api/summary/year?year=${year}&${currencyParam}` : null
  const yoyUrl = sessionReady && sessionPremium && requestedRange === 'yoy'
    ? `/api/summary/yoy?year=${year}&${currencyParam}` : null
  const fy = useReport<YearReport>(fyUrl)
  const yoy = useReport<YoyReportData>(yoyUrl)

  // The server has the last word on the tier (e.g. a session from before a downgrade)
  const serverLocked = (fyUrl !== null && isLocked(fy.data)) || (yoyUrl !== null && isLocked(yoy.data))
  const premium = sessionPremium && !serverLocked
  const range: ReportRange = premium ? requestedRange : '3m'
  const showLock = sessionReady && !premium && requestedRange !== '3m'

  const quarter = useReport<RangeReport>(sessionReady && range === '3m' ? `/api/summary/range?${currencyParam}` : null)

  const formatAmount = (v: number) => formatAmountWhole(v, viewCurrency)
  const formatCompact = (v: number) => formatAmountCompact(v, viewCurrency)

  const updateParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    const query = params.toString()
    router.replace(query ? `/reports?${query}` : '/reports', { scroll: false })
  }

  const setRange = (next: ReportRange) => {
    if (next === '3m') return updateParams({ range: null, year: null })
    // Carry over a year the user picked, when the other range offers it too (YoY can't
    // show the window's first year); otherwise the new range starts at this year
    const keepYear = searchParams.has('year') && parsedYear.ok && selectableYears(true, now, next).includes(year)
    updateParams({ range: next, year: keepYear ? String(year) : null })
  }

  // ── Header subtitle ────────────────────────────────────────────────────────
  const quarterData = quarter.data && !isLocked(quarter.data) ? quarter.data : null
  const fyData = fy.data && !isLocked(fy.data) ? fy.data : null
  const yoyData = yoy.data && !isLocked(yoy.data) ? yoy.data : null

  let subtitle: string | null = null
  let yearToDate = false
  if (range === 'fy') {
    subtitle = `Jan – Dec ${year}`
  } else if (range === 'yoy') {
    const months = yoyData?.year === year ? yoyData.monthsCovered : monthsCoveredIn(year, now)
    subtitle = `${monthSpan(months)} ${year} vs ${monthSpan(months)} ${year - 1}`
    yearToDate = months < 12
  } else if (quarterData && quarterData.months.length > 0) {
    const first = quarterData.months[0]
    const last = quarterData.months[quarterData.months.length - 1]
    subtitle = `${first.label} – ${last.label} ${last.key.split('-')[0]}`
  }

  // ── Year picker options: the report's own list once loaded, else the Premium window ──
  const loadedYears: AvailableYear[] | undefined = range === 'fy' ? fyData?.availableYears : yoyData?.availableYears
  const pickerYears = loadedYears ?? selectableYears(true, now, yearMode).map((y) => ({ year: y, hasData: true }))

  const exportHref = range === '3m'
    ? `/api/summary/export?format=csv&${currencyParam}`
    : `/api/summary/export?format=csv&range=${range}&year=${year}&${currencyParam}`

  const reportProps = { view, formatAmount, formatCompact, isCurrentYear: year === currentYear }

  const renderBody = () => {
    if (!sessionReady) return <ReportBodySkeleton />
    if (range === 'fy') {
      if (fy.loading) return <ReportBodySkeleton stats />
      if (fy.error || !fyData) return <ReportError message={fy.error} onRetry={fy.refetch} />
      if (fyData.monthsWithData === 0) return <EmptyYearCard year={year} firstYearWithData={fyData.firstYearWithData} />
      return <FullYearReport report={fyData} currencySymbol={getCurrencySymbol(viewCurrency)} {...reportProps} />
    }
    if (range === 'yoy') {
      if (yoy.loading) return <ReportBodySkeleton stats />
      if (yoy.error || !yoyData) return <ReportError message={yoy.error} onRetry={yoy.refetch} />
      if (!yoyData.current.months.some(hasActivity)) {
        return <EmptyYearCard year={year} firstYearWithData={yoyData.firstYearWithData} />
      }
      return <YoyReport report={yoyData} {...reportProps} />
    }
    if (quarter.loading) return <ReportBodySkeleton />
    if (quarter.error || !quarterData) return <ReportError message={quarter.error} onRetry={quarter.refetch} />
    return <ThreeMonthReport report={quarterData} {...reportProps} />
  }

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Monthly Report</h1>
          <div className={styles.subtitleRow}>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            {yearToDate && <span className={styles.pill}>Year to date</span>}
          </div>
        </div>

        <div className={styles.actions}>
          <ViewCurrencySwitcher />
          <div className={styles.actionGroup}>
            <div className={styles.segmented} role="group" aria-label="Category view">
              <button
                type="button"
                className={`${styles.segment} ${styles.viewSegment}`}
                aria-pressed={view === 'chart'}
                onClick={() => updateParams({ view: 'chart' })}
              >
                <PieChart size={12} aria-hidden /> Chart
              </button>
              <button
                type="button"
                className={`${styles.segment} ${styles.viewSegment}`}
                aria-pressed={view === 'table'}
                onClick={() => updateParams({ view: 'table' })}
              >
                <Tags size={12} aria-hidden /> Table
              </button>
            </div>
            <a href={exportHref} className={styles.iconButton} aria-label="Download CSV" title="Download CSV">
              <Download size={13} aria-hidden />
            </a>
          </div>
        </div>
      </div>

      {/* ── Range + year ───────────────────────────────────────────────── */}
      {sessionReady ? (
        <div className={styles.rangeRow}>
          <RangeSwitcher value={range} premium={premium} onChange={setRange} />
          {premium && range !== '3m' && (
            <YearPicker
              value={year}
              years={pickerYears}
              currentYear={currentYear}
              onChange={(y) => updateParams({ year: String(y) })}
            />
          )}
        </div>
      ) : (
        <Skeleton style={{ height: 32, width: 330, maxWidth: '100%', borderRadius: 8 }} />
      )}

      {showLock && <PremiumLockCard />}

      {renderBody()}

      {sessionReady && <PlanFooter premium={premium} />}
    </div>
  )
}
