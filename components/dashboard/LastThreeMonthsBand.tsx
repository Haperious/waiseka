'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export interface RangeMonth {
  key: string
  label: string
  income: number
  expenses: number
  savings: number
  leftover: number
  savingsRate: number
}

export interface CategoryMover {
  name: string
  color: string
  byMonth: number[]
  average: number
  currentVsAverage: number
}

interface LastThreeMonthsBandProps {
  months: RangeMonth[]
  movers: CategoryMover[]
  loading: boolean
  formatAmount: (v: number) => string
}

const NICE_RESIDUALS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 9, 10]

/** Rounds up to a "nice" chart-axis number (72300 -> 75000). */
function niceCeil(value: number): number {
  if (value <= 0) return 0
  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const residual = value / magnitude
  const niceResidual = NICE_RESIDUALS.find((r) => r >= residual) ?? 10
  return Math.round(niceResidual * magnitude)
}

function abbreviateAxis(value: number): string {
  if (value <= 0) return '0'
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10}M`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return `${Math.round(value)}`
}

const LEGEND = [
  { label: 'Income', color: 'var(--color-income)' },
  { label: 'Expenses', color: 'var(--color-expense)' },
  { label: 'Savings', color: 'var(--color-savings)' },
]

export default function LastThreeMonthsBand({ months, movers, loading, formatAmount }: LastThreeMonthsBandProps) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => setAnimated(true), 60)
    return () => clearTimeout(t)
  }, [loading])

  const maxValue = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses, m.savings]))
  const axisTop = niceCeil(maxValue)
  const axisMid = niceCeil(axisTop / 2)
  const currentKey = months[months.length - 1]?.key

  const monthsWithData = months.filter((m) => m.income > 0 || m.expenses > 0 || m.savings > 0).length
  const insufficientData = !loading && months.length > 0 && monthsWithData < 2
  const showMovers = !loading && !insufficientData && months.length > 0
  const showTwoColumns = loading || showMovers

  const current = months[months.length - 1]
  const prev = months[months.length - 2]

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <style>{`
        @media (max-width: 900px) {
          .ltm-body { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .ltm-chart-row { flex-wrap: wrap !important; gap: 12px !important; height: auto !important; }
          .ltm-chart-legend { flex-direction: row !important; flex-wrap: wrap !important; gap: 12px !important; padding-bottom: 0 !important; order: 3; width: 100%; }
          .ltm-movers-grid { grid-template-columns: 1fr !important; }
          .ltm-mover-figure { width: 76px !important; font-size: 0.72rem !important; }
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
      }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Last 3 months</p>
        <Link href="/reports" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
          Full month-by-month report →
        </Link>
      </div>

      <div
        className="ltm-body"
        style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: showTwoColumns ? '330px 1fr' : '1fr',
          gap: 24,
        }}
      >
        <ChartColumn
          months={loading ? PLACEHOLDER_MONTHS : months}
          loading={loading}
          maxValue={maxValue}
          axisTop={axisTop}
          axisMid={axisMid}
          currentKey={currentKey}
          animated={animated}
        />

        {loading ? (
          <MoversColumnSkeleton />
        ) : showMovers ? (
          <div>
            <p style={{
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', color: 'var(--color-text-muted)', marginBottom: 10,
            }}>
              Biggest movers vs. your 3-month average
            </p>
            {movers.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Not enough category history yet to spot movers.
              </p>
            ) : (
              <div className="ltm-movers-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 22px' }}>
                {movers.map((c) => (
                  <MoverRow key={c.name} category={c} formatAmount={formatAmount} animated={animated} />
                ))}
              </div>
            )}

            {current && (
              <p style={{ margin: '12px 0 0', fontSize: '0.76rem', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                {current.label} is at a {current.savingsRate}% savings rate ({formatAmount(current.savings)} to savings on {formatAmount(current.income)} in)
                {prev ? `, ${current.savingsRate >= prev.savingsRate ? 'up' : 'down'} from ${prev.savingsRate}% in ${prev.label}.` : '.'}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {!loading && months.length === 0 && (
        <div style={{ padding: '0 20px 16px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          No transactions yet - add one to start seeing your trend here.
        </div>
      )}

      {insufficientData && (
        <div style={{ padding: '0 20px 16px', fontSize: '0.76rem', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
          Come back next month — WaiseKa needs two months to compare.
        </div>
      )}
    </div>
  )
}

// ── Chart column ─────────────────────────────────────────────────────────────

const PLACEHOLDER_MONTHS: RangeMonth[] = [
  { key: 'p0', label: '', income: 60, expenses: 40, savings: 15, leftover: 0, savingsRate: 0 },
  { key: 'p1', label: '', income: 50, expenses: 45, savings: 10, leftover: 0, savingsRate: 0 },
  { key: 'p2', label: '', income: 80, expenses: 55, savings: 25, leftover: 0, savingsRate: 0 },
]

function ChartColumn({
  months, loading, maxValue, axisTop, axisMid, currentKey, animated,
}: {
  months: RangeMonth[]
  loading: boolean
  maxValue: number
  axisTop: number
  axisMid: number
  currentKey: string | undefined
  animated: boolean
}) {
  return (
    <div className="ltm-chart-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 132 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        height: 108, paddingBottom: 18,
        fontSize: '0.62rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{loading ? '' : abbreviateAxis(axisTop)}</span>
        <span>{loading ? '' : abbreviateAxis(axisMid)}</span>
        <span>{loading ? '' : '0'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', flex: 1, height: 132 }}>
        {months.map((m) => (
          <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 108 }}>
              <Bar value={m.income} max={maxValue} color={loading ? 'var(--color-elevated)' : 'var(--color-income)'} animated={animated || loading} />
              <Bar value={m.expenses} max={maxValue} color={loading ? 'var(--color-elevated)' : 'var(--color-expense)'} animated={animated || loading} />
              <Bar value={m.savings} max={maxValue} color={loading ? 'var(--color-elevated)' : 'var(--color-savings)'} animated={animated || loading} />
            </div>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700,
              color: loading ? 'transparent' : m.key === currentKey ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
              {loading ? '   ' : m.label.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div className="ltm-chart-legend" style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingBottom: 22 }}>
        {LEGEND.map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bar({ value, max, color, animated }: { value: number; max: number; color: string; animated: boolean }) {
  const heightPct = Math.max(2, (value / max) * 100)
  return (
    <div
      style={{
        width: 13,
        height: animated ? `${heightPct}%` : '0%',
        borderRadius: '3px 3px 0 0',
        backgroundColor: color,
        transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
      }}
    />
  )
}

// ── Movers column ────────────────────────────────────────────────────────────

function MoverRow({ category, formatAmount, animated }: {
  category: CategoryMover
  formatAmount: (v: number) => string
  animated: boolean
}) {
  const current = category.byMonth[category.byMonth.length - 1] ?? 0
  const delta = category.currentVsAverage
  const max = Math.max(1, ...category.byMonth)

  const barVerdictColor =
    delta < 0 ? 'var(--color-accent)' :
    delta > 5 ? 'var(--color-expense)' :
    'var(--color-warning)'

  const figureColor =
    Math.abs(delta) < 2 ? 'var(--color-text-secondary)' :
    delta < 0 ? 'var(--color-income)' :
    'var(--color-expense)'

  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {category.name}
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, flexShrink: 0 }}>
        {category.byMonth.map((v, i) => (
          <div
            key={i}
            style={{
              width: 6,
              borderRadius: 2,
              height: animated ? `${Math.max(10, (v / max) * 100)}%` : '0%',
              backgroundColor: i === category.byMonth.length - 1 ? barVerdictColor : 'var(--color-elevated)',
              transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        ))}
      </div>

      <span className="ltm-mover-figure" style={{
        width: 96, flexShrink: 0, textAlign: 'right',
        fontSize: '0.78rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: figureColor,
      }}>
        {formatAmount(current)} {sign}{Math.abs(delta)}%
      </span>
    </div>
  )
}

function MoversColumnSkeleton() {
  return (
    <div>
      <div style={{ height: 9, width: '70%', borderRadius: 4, backgroundColor: 'var(--color-elevated)', marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 22px' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 12, borderRadius: 4, backgroundColor: 'var(--color-elevated)' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, flexShrink: 0 }}>
              {[40, 60, 80].map((h, j) => (
                <div key={j} style={{ width: 6, height: `${h}%`, borderRadius: 2, backgroundColor: 'var(--color-elevated)' }} />
              ))}
            </div>
            <div style={{ width: 96, height: 12, borderRadius: 4, backgroundColor: 'var(--color-elevated)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
