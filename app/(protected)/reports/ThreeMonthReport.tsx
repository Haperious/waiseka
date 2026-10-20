'use client'

import type { ReactNode } from 'react'
import { MONTH_NAMES } from '@/lib/constants'
import type { RangeReport } from '@/lib/services/monthlyStats'
import { BarChart, CategoryPanel, CategoryTile, CategoryTiles, WhereItWent, type ChartColumn } from './ReportParts'
import { rateLabelColor, savingsRateColor, type ReportView } from './reportModel'
import styles from './reports.module.css'

interface Props {
  report: RangeReport
  view: ReportView
  formatAmount: (v: number) => string
  formatCompact: (v: number) => string
}

/** "2026-10" style key -> full month name. */
function monthName(key: string): string {
  const month = Number(key.split('-')[1])
  return MONTH_NAMES[month - 1] ?? key
}

/** The shipped report: the last 3 calendar months, for every plan. */
export default function ThreeMonthReport({ report, view, formatAmount, formatCompact }: Props) {
  const currentIdx = report.months.length - 1
  const current = report.months[currentIdx]

  const columns: ChartColumn[] = report.months.map((m, i) => ({
    key: m.key,
    xLabel: `${m.label.toUpperCase()} · ${m.savingsRate}%`,
    xLabelColor: rateLabelColor(m.savingsRate, i === currentIdx),
    bars: [
      { value: m.income, color: 'var(--color-income)', label: formatAmount(m.income), compactLabel: formatCompact(m.income) },
      { value: m.expenses, color: 'var(--color-expense)', label: formatAmount(m.expenses), compactLabel: formatCompact(m.expenses) },
      { value: m.savings, color: 'var(--color-savings)', label: formatAmount(m.savings), compactLabel: formatCompact(m.savings) },
    ],
  }))

  const currentSpend = report.categories
    .map((c) => ({ name: c.name, color: c.color, amount: c.byMonth[currentIdx] }))
    .filter((c) => c.amount > 0)

  const tiles = report.categories
    .filter((c) => c.byMonth[currentIdx] > 0)
    .sort((a, b) => b.byMonth[currentIdx] - a.byMonth[currentIdx])

  return (
    <>
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <BarChart
            columns={columns}
            variant="quarter"
            ariaLabel={`Income, expenses and savings for ${report.months.map((m) => m.label).join(', ')}`}
          />
        </div>
        <WhereItWent
          title={`Where ${monthName(current.key)} went`}
          items={currentSpend}
          formatAmount={formatAmount}
        />
      </div>

      <div className={styles.monthCards}>
        {report.months.map((m, i) => {
          const isCurrent = i === currentIdx
          return (
            <div key={m.key} className={`${styles.monthCard} ${isCurrent ? styles.monthCardCurrent : ''}`}>
              <div className={styles.cardHead} style={{ alignItems: 'center' }}>
                <span className={styles.eyebrow} style={{ color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {monthName(m.key)}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: savingsRateColor(m.savingsRate) }}>
                  {m.savingsRate}%
                </span>
              </div>
              <MonthRow label="Income" color="var(--color-income)">{formatAmount(m.income)}</MonthRow>
              <MonthRow label="Expenses" color="var(--color-expense)">{formatAmount(m.expenses)}</MonthRow>
              <MonthRow label="Savings moved" color="var(--color-savings)">{formatAmount(m.savings)}</MonthRow>
              <div className={styles.divider} />
              <MonthRow label="Left over" color="var(--color-text-primary)" bold>{formatAmount(m.leftover)}</MonthRow>
            </div>
          )
        })}
      </div>

      {view === 'table' ? (
        <CategoryPanel title="Category breakdown">
          <QuarterTable report={report} formatAmount={formatAmount} />
        </CategoryPanel>
      ) : (
        <CategoryPanel title="By category, month over month">
          <CategoryTiles>
            {tiles.map((c) => {
              const max = Math.max(1, ...c.byMonth)
              const d = c.currentVsAverage
              return (
                <CategoryTile
                  key={c.name}
                  name={c.name}
                  amount={formatAmount(c.byMonth[currentIdx])}
                  note={`· ${d > 0 ? '+' : ''}${d}% vs avg`}
                  noteColor={d > 0 ? 'var(--color-expense)' : d < 0 ? 'var(--color-income)' : 'var(--color-text-secondary)'}
                  barWidth={10}
                  barGap={3}
                  bars={c.byMonth.map((v, i) => ({
                    height: `${Math.max(6, (v / max) * 100)}%`,
                    color: i === currentIdx ? c.color : 'var(--color-border)',
                  }))}
                />
              )
            })}
          </CategoryTiles>
        </CategoryPanel>
      )}
    </>
  )
}

function MonthRow({ label, color, bold, children }: { label: string; color: string; bold?: boolean; children: ReactNode }) {
  return (
    <div className={styles.monthRow}>
      <span>{label}</span>
      <span style={{ color, fontWeight: bold ? 800 : 700 }}>{children}</span>
    </div>
  )
}

function QuarterTable({ report, formatAmount }: { report: RangeReport; formatAmount: (v: number) => string }) {
  const currentIdx = report.months.length - 1
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table} style={{ minWidth: 640, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {report.months.map((m, i) => (
              <th key={m.key} scope="col" style={i === currentIdx ? { color: 'var(--color-accent)' } : undefined}>{m.label}</th>
            ))}
            <th scope="col">Trend</th>
            <th scope="col">3-mo Avg</th>
            <th scope="col">vs Avg</th>
          </tr>
        </thead>
        <tbody>
          {report.categories.map((c) => {
            const max = Math.max(1, ...c.byMonth)
            const d = c.currentVsAverage
            const deltaColor = d > 0 ? 'var(--color-expense)' : d < 0 ? 'var(--color-income)' : 'var(--color-text-muted)'
            return (
              <tr key={c.name}>
                <td className={styles.categoryCell}>{c.name}</td>
                {c.byMonth.map((v, i) => (
                  <td key={i} className={i === currentIdx ? styles.strong : undefined}>{formatAmount(v)}</td>
                ))}
                <td>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 2, height: 20 }} aria-hidden>
                    {c.byMonth.map((v, i) => (
                      <div key={i} style={{
                        width: 7, height: `${Math.max(15, (v / max) * 100)}%`,
                        backgroundColor: i === currentIdx ? c.color : 'var(--color-border)',
                      }} />
                    ))}
                  </div>
                </td>
                <td>{formatAmount(c.average)}</td>
                <td style={{ fontWeight: 700, color: deltaColor }}>{d === 0 ? 'flat' : `${d > 0 ? '+' : ''}${d}%`}</td>
              </tr>
            )
          })}
          <tr className={styles.totalRow}>
            <td>Total</td>
            {report.months.map((m) => <td key={m.key}>{formatAmount(m.expenses)}</td>)}
            <td />
            <td>{formatAmount(report.totals.expenses / report.months.length)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
