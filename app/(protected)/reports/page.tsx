'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PieChart, Tags, Download, Crown, Lightbulb } from 'lucide-react'
import { useCurrency } from '@/context/CurrencyContext'
import { Skeleton } from '@/components/ui/Skeleton'
import { FREE_HISTORY_DAYS, PREMIUM_HISTORY_DAYS } from '@/lib/constants'
import { usePreferences } from '@/hooks/usePreferences'

interface RangeMonth {
  key: string
  label: string
  income: number
  expenses: number
  savings: number
  leftover: number
  savingsRate: number
}
interface RangeCategory {
  name: string
  color: string
  byMonth: number[]
  average: number
  currentVsAverage: number
}
interface RangeReport {
  months: RangeMonth[]
  categories: RangeCategory[]
  totals: RangeMonth
}

const SAVINGS_RATE_COLOR = (rate: number) =>
  rate >= 20 ? 'var(--color-accent)' : rate >= 10 ? 'var(--color-warning)' : 'var(--color-text-muted)'

export default function ReportsPage() {
  const { formatAmount } = useCurrency()
  const { preferences } = usePreferences()
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const view = viewParam === 'table' || viewParam === 'chart'
    ? viewParam
    : preferences?.reportsDefaultView ?? 'chart'

  const [report, setReport] = useState<RangeReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/summary/range')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReport(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const setView = (next: 'chart' | 'table') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`/reports?${params.toString()}`, { scroll: false })
  }

  const currentMonth = report?.months[report.months.length - 1]
  const maxMonthly = useMemo(
    () => Math.max(1, ...(report?.months.flatMap((m) => [m.income, m.expenses, m.savings]) ?? [])),
    [report]
  )

  const currentMonthCategories = useMemo(() => {
    if (!report) return []
    const idx = report.months.length - 1
    return report.categories
      .map((c) => ({ ...c, currentAmount: c.byMonth[idx] }))
      .filter((c) => c.currentAmount > 0)
      .sort((a, b) => b.currentAmount - a.currentAmount)
  }, [report])

  const currentMonthTotal = currentMonthCategories.reduce((s, c) => s + c.currentAmount, 0)

  const freeYears = Math.round(FREE_HISTORY_DAYS / 365)
  const premiumYears = Math.round(PREMIUM_HISTORY_DAYS / 365)

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @media (max-width: 640px) {
          .reports-header { flex-direction: column !important; align-items: flex-start !important; }
          .reports-header-actions { width: 100% !important; justify-content: space-between !important; }
          .reports-bar-col { flex: 0 0 56px !important; }
          .reports-bar-track { overflow-x: auto !important; padding-bottom: 4px; }
          .reports-month-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="reports-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: '1.25rem',
            color: 'var(--color-text-primary)',
          }}>
            Monthly Report
          </h1>
          {report && (
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {report.months[0].label} – {currentMonth?.label} {new Date().getFullYear()}
            </p>
          )}
        </div>

        <div className="reports-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden',
          }}>
            <button
              onClick={() => setView('chart')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', fontSize: '0.74rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                backgroundColor: view === 'chart' ? 'var(--color-sage)' : 'var(--color-card)',
                color: view === 'chart' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              <PieChart style={{ width: 12, height: 12 }} /> Chart
            </button>
            <div style={{ width: 1, backgroundColor: 'var(--color-border)' }} />
            <button
              onClick={() => setView('table')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', fontSize: '0.74rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                backgroundColor: view === 'table' ? 'var(--color-sage)' : 'var(--color-card)',
                color: view === 'table' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              <Tags style={{ width: 12, height: 12 }} /> Table
            </button>
          </div>

          <a
            href="/api/summary/export?format=csv"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-card)', color: 'var(--color-text-secondary)',
            }}
            aria-label="Export CSV"
          >
            <Download style={{ width: 13, height: 13 }} />
          </a>
        </div>
      </div>

      {loading || !report ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          {/* ── Bar chart + where-it-went strip ───────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }} className="max-lg:!grid-cols-1">
            <div style={{
              backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '18px 20px',
            }}>
              <div className="reports-bar-track" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 210 }}>
                {report.months.map((m) => (
                  <div key={m.key} className="reports-bar-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flex: 1 }}>
                      <MonthBar value={m.income} max={maxMonthly} color="var(--color-income)" formatAmount={formatAmount} />
                      <MonthBar value={m.expenses} max={maxMonthly} color="var(--color-expense)" formatAmount={formatAmount} />
                      <MonthBar value={m.savings} max={maxMonthly} color="var(--color-savings)" formatAmount={formatAmount} />
                    </div>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, marginTop: 8,
                      color: m.key === currentMonth?.key ? 'var(--color-accent)'
                        : m.savingsRate < 15 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    }}>
                      {m.label.toUpperCase()} · {m.savingsRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <p style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Where {currentMonth?.label} went
              </p>
              <div style={{ height: 22, borderRadius: 999, overflow: 'hidden', display: 'flex', backgroundColor: 'var(--color-elevated)' }}>
                {currentMonthCategories.slice(0, 6).map((c) => (
                  <div
                    key={c.name}
                    style={{ width: `${(c.currentAmount / (currentMonthTotal || 1)) * 100}%`, backgroundColor: c.color }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentMonthCategories.slice(0, 6).map((c) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                      {formatAmount(c.currentAmount)}
                    </span>
                    <span style={{ width: 34, textAlign: 'right', color: 'var(--color-text-muted)' }}>
                      {Math.round((c.currentAmount / (currentMonthTotal || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Month cards ────────────────────────────────────────────────── */}
          <div className="reports-month-cards" style={{ display: 'grid', gridTemplateColumns: `repeat(${report.months.length}, 1fr)`, gap: 12 }}>
            {report.months.map((m) => {
              const isCurrent = m.key === currentMonth?.key
              return (
                <div
                  key={m.key}
                  style={{
                    backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
                    borderLeft: isCurrent ? '3px solid var(--color-accent)' : '1px solid var(--color-border)',
                    borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>
                      {m.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: SAVINGS_RATE_COLOR(m.savingsRate) }}>
                      {m.savingsRate}%
                    </span>
                  </div>
                  <MonthCardRow label="Income" value={formatAmount(m.income)} color="var(--color-income)" />
                  <MonthCardRow label="Expenses" value={formatAmount(m.expenses)} color="var(--color-expense)" />
                  <MonthCardRow label="Savings moved" value={formatAmount(m.savings)} color="var(--color-savings)" />
                  <div style={{ height: 1, backgroundColor: 'var(--color-border)' }} />
                  <MonthCardRow label="Left over" value={formatAmount(m.leftover)} color="var(--color-text-primary)" bold />
                </div>
              )
            })}
          </div>

          {/* ── Toggled category panel ────────────────────────────────────── */}
          <div style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {view === 'table' ? 'Category breakdown' : 'By category, month over month'}
              </p>
            </div>

            {view === 'table' ? (
              <CategoryTable report={report} formatAmount={formatAmount} />
            ) : (
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="max-lg:!grid-cols-1">
                {report.categories.map((c) => {
                  const deltaColor = c.currentVsAverage > 0 ? 'var(--color-expense)' : c.currentVsAverage < 0 ? 'var(--color-income)' : 'var(--color-text-secondary)'
                  const max = Math.max(1, ...c.byMonth)
                  return (
                    <div key={c.name} style={{
                      border: '1px solid var(--color-border)', borderRadius: 12, backgroundColor: 'var(--color-elevated)',
                      padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                          {formatAmount(c.byMonth[c.byMonth.length - 1])} ·{' '}
                          <span style={{ color: deltaColor }}>
                            {c.currentVsAverage > 0 ? '+' : ''}{c.currentVsAverage}% vs avg
                          </span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, flexShrink: 0 }}>
                        {c.byMonth.map((v, i) => (
                          <div key={i} style={{
                            width: 10, borderRadius: '2px 2px 0 0',
                            height: `${Math.max(6, (v / max) * 100)}%`,
                            backgroundColor: i === c.byMonth.length - 1 ? c.color : 'var(--color-border)',
                          }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Lightbulb style={{ width: 15, height: 15, color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
                Recurring obligations are the amount you can&apos;t move month to month. Everything else in your
                category breakdown is where you have room to cut.
              </p>
            </div>
          </div>

          {/* ── Premium retention line ────────────────────────────────────── */}
          <div style={{
            backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
            borderLeft: '3px solid var(--color-premium, #D97706)', borderRadius: 14,
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              backgroundColor: 'color-mix(in srgb, var(--color-premium, #D97706) 15%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Crown style={{ width: 14, height: 14, color: 'var(--color-premium, #D97706)' }} />
            </div>
            <p style={{ fontSize: '0.79rem', lineHeight: 1.55, color: 'var(--color-text-secondary)', flex: 1 }}>
              Your plan keeps the last <strong>{freeYears} years</strong>. Premium keeps {premiumYears} years and
              adds full-year and year-on-year views.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function MonthBar({ value, max, color, formatAmount }: { value: number; max: number; color: string; formatAmount: (v: number) => string }) {
  const pct = Math.max(2, (value / max) * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
      <span style={{ fontSize: '0.64rem', fontWeight: 700, marginBottom: 4, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {formatAmount(value)}
      </span>
      <div style={{ width: 26, height: `${pct}%`, borderRadius: '3px 3px 0 0', backgroundColor: color }} />
    </div>
  )
}

function MonthCardRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 800 : 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function CategoryTable({ report, formatAmount }: { report: RangeReport; formatAmount: (v: number) => string }) {
  const currentIdx = report.months.length - 1
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-surface)' }}>
            <Th align="left">Category</Th>
            {report.months.map((m, i) => (
              <Th key={m.key} color={i === currentIdx ? 'var(--color-accent)' : undefined}>{m.label}</Th>
            ))}
            <Th>Trend</Th>
            <Th>3-mo Avg</Th>
            <Th>vs Avg</Th>
          </tr>
        </thead>
        <tbody>
          {report.categories.map((c) => {
            const max = Math.max(1, ...c.byMonth)
            const deltaColor = c.currentVsAverage > 0 ? 'var(--color-expense)' : c.currentVsAverage < 0 ? 'var(--color-income)' : 'var(--color-text-muted)'
            return (
              <tr key={c.name} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 20px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{c.name}</td>
                {c.byMonth.map((v, i) => (
                  <td key={i} style={{
                    padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    color: i === currentIdx ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: i === currentIdx ? 700 : 400,
                  }}>
                    {formatAmount(v)}
                  </td>
                ))}
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
                    {c.byMonth.map((v, i) => (
                      <div key={i} style={{
                        width: 7, height: `${Math.max(15, (v / max) * 100)}%`,
                        backgroundColor: i === currentIdx ? c.color : 'var(--color-border)',
                      }} />
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                  {formatAmount(c.average)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: c.currentVsAverage === 0 ? 'var(--color-text-muted)' : deltaColor }}>
                  {c.currentVsAverage === 0 ? 'flat' : `${c.currentVsAverage > 0 ? '+' : ''}${c.currentVsAverage}%`}
                </td>
              </tr>
            )
          })}
          <tr style={{ backgroundColor: 'var(--color-elevated)', fontWeight: 800 }}>
            <td style={{ padding: '10px 20px', color: 'var(--color-text-primary)' }}>Total</td>
            {report.months.map((m) => (
              <td key={m.key} style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                {formatAmount(m.expenses)}
              </td>
            ))}
            <td />
            <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatAmount(report.totals.expenses / report.months.length)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = 'right', color }: { children: React.ReactNode; align?: 'left' | 'right'; color?: string }) {
  return (
    <th style={{
      padding: '10px 14px', textAlign: align, fontSize: '0.62rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.09em',
      color: color ?? 'var(--color-text-muted)',
    }}>
      {children}
    </th>
  )
}
