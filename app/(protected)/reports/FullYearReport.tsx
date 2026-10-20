'use client'

import { MONTH_LABELS } from '@/lib/constants'
import type { YearReport } from '@/lib/services/yearReport'
import {
  BarChart, CategoryPanel, CategoryTile, CategoryTiles, StatTiles, WhereItWent,
  type ChartColumn, type StatTile,
} from './ReportParts'
import { hasActivity, monthSpan, plainNumber, rateLabelColor, type ReportView } from './reportModel'
import styles from './reports.module.css'

interface Props {
  report: YearReport
  view: ReportView
  /** Whether `report.year` is the current year, so its last covered month is "now". */
  isCurrentYear: boolean
  /** The view currency's symbol, named once in the table caption instead of in every cell. */
  currencySymbol: string
  formatAmount: (v: number) => string
  formatCompact: (v: number) => string
}

export function yearStatTiles(totals: YearReport['totals'], formatAmount: (v: number) => string): StatTile[] {
  return [
    { label: 'Income', value: formatAmount(totals.income), color: 'var(--color-income)' },
    { label: 'Expenses', value: formatAmount(totals.expenses), color: 'var(--color-expense)' },
    { label: 'Savings', value: formatAmount(totals.savings), color: 'var(--color-savings)' },
    { label: 'Left over', value: formatAmount(totals.leftover), color: 'var(--color-text-primary)' },
    {
      label: 'Savings rate',
      value: `${totals.savingsRate}%`,
      color: totals.savingsRate >= 20 ? 'var(--color-accent)' : 'var(--color-warning)',
    },
    { label: 'Avg monthly spend', value: formatAmount(totals.avgMonthlySpend), color: 'var(--color-text-primary)' },
  ]
}

/** Premium: Jan-Dec of one year. Months that haven't started show as dashed slots. */
export default function FullYearReport({ report, view, isCurrentYear, currencySymbol, formatAmount, formatCompact }: Props) {
  const { monthsCovered } = report
  const partial = monthsCovered < 12
  const currentIdx = isCurrentYear ? monthsCovered - 1 : -1

  const columns: ChartColumn[] = report.months.map((m, i) => {
    const label = m.label.toUpperCase()
    if (i >= monthsCovered) {
      return { key: m.key, xLabel: `${label} · —`, xLabelColor: 'var(--color-text-muted)', bars: null }
    }
    const active = hasActivity(m)
    return {
      key: m.key,
      xLabel: `${label} · ${active ? `${m.savingsRate}%` : '—'}`,
      xLabelColor: active ? rateLabelColor(m.savingsRate, i === currentIdx) : 'var(--color-text-muted)',
      bars: [
        { value: m.income, color: 'var(--color-income)', label: formatCompact(m.income) },
        { value: m.expenses, color: 'var(--color-expense)', label: formatCompact(m.expenses) },
        { value: m.savings, color: 'var(--color-savings)', label: formatCompact(m.savings) },
      ],
    }
  })

  const span = partial ? monthSpan(monthsCovered) : undefined
  // Same divisor as the Avg monthly spend tile
  const avgDivisor = Math.max(1, report.monthsWithData)

  return (
    <>
      <div className={`${styles.topGrid} ${styles.topGridWide}`}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <BarChart columns={columns} variant="year" ariaLabel={`Income, expenses and savings by month, ${report.year}`} />
        </div>
        <WhereItWent
          title={`Where ${report.year} went`}
          note={span}
          items={report.categories.map((c) => ({ name: c.name, color: c.color, amount: c.total }))}
          formatAmount={formatAmount}
        />
      </div>

      <StatTiles
        tiles={yearStatTiles(report.totals, formatAmount)}
        footnote={partial ? `Totals and averages cover ${span} (${monthsCovered} ${monthsCovered === 1 ? 'month' : 'months'}).` : undefined}
      />

      {view === 'table' ? (
        <CategoryPanel title="Category breakdown" caption={`Amounts in ${currencySymbol}`}>
          <YearTable report={report} avgDivisor={avgDivisor} />
        </CategoryPanel>
      ) : (
        <CategoryPanel title="By category, month over month" caption={`Highest month highlighted${span ? ` · ${span}` : ''}`}>
          <CategoryTiles>
            {report.categories.map((c) => {
              const max = Math.max(1, ...c.byMonth)
              return (
                <CategoryTile
                  key={c.name}
                  name={c.name}
                  amount={formatAmount(c.total)}
                  note={c.isFixed ? '· same every month' : `· peak ${MONTH_LABELS[c.peakMonth]}`}
                  barWidth={6}
                  barGap={2}
                  bars={c.byMonth.map((v, i) => i >= monthsCovered
                    ? { height: '6%', color: 'transparent' }
                    : {
                        height: `${Math.max(6, (v / max) * 100)}%`,
                        color: !c.isFixed && i === c.peakMonth ? c.color : 'var(--color-border)',
                      })}
                />
              )
            })}
          </CategoryTiles>
        </CategoryPanel>
      )}
    </>
  )
}

function YearTable({ report, avgDivisor }: { report: YearReport; avgDivisor: number }) {
  const covered = (i: number) => i < report.monthsCovered
  const monthTotals = MONTH_LABELS.map((_, i) => report.categories.reduce((s, c) => s + c.byMonth[i], 0))
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0)
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.yearTable}`}>
        <colgroup>
          <col style={{ width: 128 }} />
          {MONTH_LABELS.map((m) => <col key={m} />)}
          <col style={{ width: 82 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 56 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {MONTH_LABELS.map((m) => <th key={m} scope="col">{m}</th>)}
            <th scope="col">Total</th>
            <th scope="col">Monthly avg</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {report.categories.map((c) => (
            <tr key={c.name}>
              <td className={styles.categoryCell} title={c.name}>{c.name}</td>
              {c.byMonth.map((v, i) => <td key={i}>{covered(i) ? plainNumber(v) : '—'}</td>)}
              <td className={styles.strong}>{plainNumber(c.total)}</td>
              <td>{plainNumber(c.total / avgDivisor)}</td>
              <td className={styles.muted}>{c.share}%</td>
            </tr>
          ))}
          <tr className={styles.totalRow}>
            <td>Total</td>
            {monthTotals.map((v, i) => <td key={i}>{covered(i) ? plainNumber(v) : '—'}</td>)}
            <td>{plainNumber(grandTotal)}</td>
            <td>{plainNumber(grandTotal / avgDivisor)}</td>
            <td>{grandTotal > 0 ? '100%' : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
