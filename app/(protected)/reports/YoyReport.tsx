'use client'

import { useState } from 'react'
import type { YoyReport as YoyReportData } from '@/lib/services/yearReport'
import {
  BarChart, CardHead, CategoryPanel, CategoryTile, CategoryTiles, StatTiles,
  type ChartColumn, type StatTile,
} from './ReportParts'
import { yearStatTiles } from './FullYearReport'
import {
  biggestChanges, changeBadge, comparisonPeriod, monthSpan, signed, signedAmount, spendTone, TONE_COLOR, YOY_METRICS,
  type ReportView, type YoyMetric,
} from './reportModel'
import styles from './reports.module.css'

interface Props {
  report: YoyReportData
  view: ReportView
  isCurrentYear: boolean
  formatAmount: (v: number) => string
  formatCompact: (v: number) => string
}

/** Premium: a year against the one before, over the same months. */
export default function YoyReport({ report, view, isCurrentYear, formatAmount, formatCompact }: Props) {
  const [metric, setMetric] = useState<YoyMetric>('expenses')
  const { current, previous, monthsCovered } = report
  const metricInfo = YOY_METRICS.find((m) => m.value === metric)!
  const span = monthSpan(monthsCovered)

  const columns: ChartColumn[] = current.months.map((m, i) => {
    const prev = previous.months[i][metric]
    const curr = m[metric]
    return {
      key: m.key,
      xLabel: m.label.toUpperCase(),
      xLabelColor: isCurrentYear && i === monthsCovered - 1 ? 'var(--color-accent)' : 'var(--color-text-muted)',
      bars: [
        { value: prev, color: metricInfo.color, label: formatCompact(prev), opacity: 0.3 },
        { value: curr, color: metricInfo.color, label: formatCompact(curr) },
      ],
    }
  })

  const changes = biggestChanges(report.categoryChanges)
  const top = changes[0]

  const p = previous.totals
  const c = current.totals
  const tiles: StatTile[] = yearStatTiles(c, formatAmount).map((tile, i) => {
    const [prevValue, currValue, higherIsGood, unit] = ([
      [p.income, c.income, true, '%'],
      [p.expenses, c.expenses, false, '%'],
      [p.savings, c.savings, true, '%'],
      [p.leftover, c.leftover, true, '%'],
      [p.savingsRate, c.savingsRate, true, 'pts'],
      [p.avgMonthlySpend, c.avgMonthlySpend, false, '%'],
    ] as const)[i]
    return {
      ...tile,
      badge: changeBadge(currValue, prevValue, higherIsGood, unit),
      previous: `${unit === 'pts' ? `${prevValue}%` : formatAmount(prevValue)} in ${previous.year}`,
    }
  })

  return (
    <>
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.chartHead}>
            <div className={styles.segmented} role="group" aria-label="Metric">
              {YOY_METRICS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`${styles.segment} ${styles.metricSegment}`}
                  aria-pressed={metric === m.value}
                  onClick={() => setMetric(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ backgroundColor: metricInfo.color, opacity: 0.3 }} />
                {previous.year}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ backgroundColor: metricInfo.color }} />
                {current.year}
              </span>
            </div>
          </div>
          <BarChart
            columns={columns}
            variant="yoy"
            ariaLabel={`${metricInfo.label} by month, ${previous.year} against ${current.year}, ${span}`}
          />
        </div>

        <div className={`${styles.card} ${styles.cardPad}`} style={{ gap: 12 }}>
          <CardHead title="Biggest changes" note={`Spending, ${span}`} />
          {top ? (
            <>
              <ul className={styles.changeList}>
                {changes.map((ch) => (
                  <li key={ch.name} className={styles.legendRow}>
                    <span className={styles.dot} style={{ backgroundColor: ch.color }} />
                    <span className={styles.rowName}>{ch.name}</span>
                    <span className={styles.rowAmount} style={{ color: TONE_COLOR[spendTone(ch.delta)] }}>
                      <span aria-hidden>{ch.delta > 0 ? '▲' : '▼'} </span>
                      <span className={styles.srOnly}>{ch.delta > 0 ? 'up' : 'down'} </span>
                      {formatAmount(Math.abs(ch.delta))}
                    </span>
                    <span className={styles.rowPct} style={{ color: ch.pct === null ? 'var(--color-accent)' : undefined }}>
                      {ch.pct === null ? 'new' : `(${signed(ch.pct, '%')})`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.bodyNote}>
                {top.name} moved the most: {top.delta > 0 ? 'up' : 'down'} {formatAmount(Math.abs(top.delta))}{' '}
                {comparisonPeriod(monthsCovered, previous.year)}.
              </p>
            </>
          ) : (
            <p className={styles.bodyNote}>Spending by category is the same in both years.</p>
          )}
        </div>
      </div>

      <StatTiles
        tiles={tiles}
        footnote={`Both years cover ${span} so the comparison is like for like.`}
      />

      {view === 'table' ? (
        <CategoryPanel title="Category breakdown" caption={`${span}, ${previous.year} vs ${current.year}`}>
          <YoyTable report={report} formatAmount={formatAmount} />
        </CategoryPanel>
      ) : (
        <CategoryPanel title="By category, year on year" caption={`${span}, ${previous.year} vs ${current.year}`}>
          <CategoryTiles>
            {report.categoryChanges.map((ch) => {
              const max = Math.max(1, ch.previous, ch.current)
              return (
                <CategoryTile
                  key={ch.name}
                  name={ch.name}
                  amount={formatAmount(ch.current)}
                  note={ch.pct === null ? '· new' : `· ${signed(ch.pct, '%')} vs ${previous.year}`}
                  noteColor={ch.pct === null ? 'var(--color-accent)' : TONE_COLOR[spendTone(ch.delta)]}
                  barWidth={10}
                  barGap={3}
                  bars={[
                    { height: `${Math.max(6, (ch.previous / max) * 100)}%`, color: 'var(--color-border)' },
                    { height: `${Math.max(6, (ch.current / max) * 100)}%`, color: ch.color },
                  ]}
                />
              )
            })}
          </CategoryTiles>
        </CategoryPanel>
      )}
    </>
  )
}

function YoyTable({ report, formatAmount }: { report: YoyReportData; formatAmount: (v: number) => string }) {
  const totalPrev = report.categoryChanges.reduce((s, c) => s + c.previous, 0)
  const totalCurr = report.categoryChanges.reduce((s, c) => s + c.current, 0)
  const totalDelta = totalCurr - totalPrev
  const totalPct = totalPrev > 0 ? Math.round((totalDelta / totalPrev) * 100) : null
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.yoyTable}`}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col />
          <col />
          <col />
          <col style={{ width: '16%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">{report.previousYear}</th>
            <th scope="col" style={{ color: 'var(--color-accent)' }}>{report.year}</th>
            <th scope="col">Change</th>
            <th scope="col">Change %</th>
          </tr>
        </thead>
        <tbody>
          {report.categoryChanges.map((c) => {
            const color = TONE_COLOR[spendTone(c.delta)]
            return (
              <tr key={c.name}>
                <td className={styles.categoryCell} title={c.name}>{c.name}</td>
                <td>{c.previous > 0 ? formatAmount(c.previous) : '—'}</td>
                <td className={styles.strong}>{formatAmount(c.current)}</td>
                <td style={{ fontWeight: 700, color }}>{signedAmount(c.delta, formatAmount)}</td>
                <td style={{ fontWeight: 700, color: c.pct === null ? 'var(--color-accent)' : color }}>
                  {c.pct === null ? 'new' : signed(c.pct, '%')}
                </td>
              </tr>
            )
          })}
          <tr className={styles.totalRow}>
            <td>Total</td>
            <td>{formatAmount(totalPrev)}</td>
            <td>{formatAmount(totalCurr)}</td>
            <td style={{ color: TONE_COLOR[spendTone(totalDelta)] }}>{signedAmount(totalDelta, formatAmount)}</td>
            <td style={{ color: TONE_COLOR[spendTone(totalDelta)] }}>{totalPct === null ? '—' : signed(totalPct, '%')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
