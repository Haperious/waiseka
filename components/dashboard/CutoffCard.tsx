'use client'

export interface CutoffData {
  period: { index: number; label: string; start: string; end: string; daysTotal: number; daysLeft: number }
  income: number
  expenses: number
  savings: number
  unspent: number
  safeToSpendPerDay: number
  sweldoLandedAt: string
}

interface CutoffCardProps {
  data: CutoffData | null
  loading: boolean
  formatAmount: (v: number) => string
}

export default function CutoffCard({ data, loading, formatAmount }: CutoffCardProps) {
  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      padding: '20px 22px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 15,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{
          fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em',
          fontWeight: 600, color: 'var(--color-text-muted)',
        }}>
          Safe to spend per day
        </p>
        {data && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}>
            Cutoff {data.period.index} · {data.period.label}
          </span>
        )}
      </div>

      {loading || !data ? (
        <div style={{ height: 100 }} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '2.6rem', fontWeight: 800, lineHeight: 0.95,
              letterSpacing: '-0.025em',
              color: data.safeToSpendPerDay < 0 ? 'var(--color-expense)' : 'var(--color-accent)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatAmount(data.safeToSpendPerDay)}
            </span>
            <span style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
              for the <strong>{data.period.daysLeft} days</strong> left / {formatAmount(data.unspent)} unspent
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }} className="max-sm:!grid-cols-1">
            <CutoffTile label="Came in" value={formatAmount(data.income)} color="var(--color-income)" />
            <CutoffTile label="Went out" value={formatAmount(data.expenses)} color="var(--color-expense)" />
            <CutoffTile label="To savings" value={formatAmount(data.savings)} color="var(--color-savings)" />
          </div>

          <AllocationBar data={data} formatAmount={formatAmount} />
        </>
      )}
    </div>
  )
}

function CutoffTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ borderRadius: 10, backgroundColor: 'var(--color-elevated)', padding: '8px 10px' }}>
      <p style={{
        fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'var(--color-text-muted)', marginBottom: 3,
      }}>
        {label}
      </p>
      <p style={{ fontSize: '0.95rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

function AllocationBar({ data, formatAmount }: { data: CutoffData; formatAmount: (v: number) => string }) {
  // Base the bar on whichever is larger - income, or what actually went out - so that
  // overspending (expenses + savings > income) never pushes segment widths past 100%
  // and squeezing the "unspent" label out of view.
  const total = Math.max(data.income, data.expenses + data.savings, 0)
  const pct = (v: number) => (total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0)
  let expensePct = pct(data.expenses)
  let savingsPct = pct(data.savings)
  if (expensePct + savingsPct > 100) {
    // Rounding guard - scale down proportionally so segments never overrun the bar.
    const scale = 100 / (expensePct + savingsPct)
    expensePct *= scale
    savingsPct *= scale
  }
  const unspentPct = Math.max(0, 100 - expensePct - savingsPct)
  const isOverspent = data.unspent < 0
  // Below this width the "UNSPENT" label can't fit inside its segment without clipping -
  // fall back to showing it beneath the bar instead.
  const unspentLabelFitsInBar = unspentPct >= 20

  const sweldoDate = new Date(data.sweldoLandedAt)
  const endDate = new Date(data.period.end)
  const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        height: 26, borderRadius: 8, border: '1px solid var(--color-border)',
        overflow: 'hidden', display: 'flex', position: 'relative',
      }}>
        <div style={{ width: `${expensePct}%`, backgroundColor: 'var(--color-expense)', opacity: 0.85, flexShrink: 0 }} />
        <div style={{ width: `${savingsPct}%`, backgroundColor: 'var(--color-savings)', opacity: 0.8, flexShrink: 0 }} />
        <div style={{
          width: `${unspentPct}%`, backgroundColor: 'var(--color-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {unspentLabelFitsInBar && (
            <span style={{
              fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap',
              color: 'var(--color-text-secondary)',
            }}>
              UNSPENT {formatAmount(data.unspent)}
            </span>
          )}
        </div>
      </div>
      {!unspentLabelFitsInBar && (
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
            color: isOverspent ? 'var(--color-expense)' : 'var(--color-text-secondary)',
          }}>
            {isOverspent ? 'OVERSPENT' : 'UNSPENT'} {formatAmount(data.unspent)}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>
        <span>{fmtDay(sweldoDate)} · sweldo landed</span>
        <span>{fmtDay(endDate)}</span>
      </div>
    </div>
  )
}
