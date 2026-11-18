'use client'

import { AlertTriangle, CalendarRange, ChevronRight, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount, formatAmountShort } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { Projection } from '@/lib/planner/projection'

interface PlannerSummaryProps {
  projection: Projection
  currency: string
  endDate: string
  today: string
  accountCount: number
  onEditSettings: () => void
}

function Stat({ label, value, color, onClick, action }: {
  label: string
  value: string
  color?: string
  onClick?: () => void
  action?: string
}) {
  const body = (
    <>
      <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.02rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
      {action && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-accent)' }}>
          {action} <ChevronRight size={12} />
        </span>
      )}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px', borderRadius: 12, minWidth: 0,
    backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', textAlign: 'left',
  }
  return onClick ? (
    <button type="button" onClick={onClick} style={{ ...style, cursor: 'pointer' }}>{body}</button>
  ) : (
    <div style={style}>{body}</div>
  )
}

/** Headline figures and the balance line for one plan. */
export default function PlannerSummary({ projection: p, currency, endDate, today, accountCount, onEditSettings }: PlannerSummaryProps) {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const fmt = (n: number) => formatAmount(n, currency)
  const dark = theme === 'dark'
  const lineColor = dark ? '#4ADE80' : '#16A34A'
  const belowColor = dark ? '#F87171' : '#B91C1C'
  const endColor = p.end < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)'

  const data = p.days.map((d) => ({ day: d.day, label: formatDay(d.day, today), balance: d.balance }))
  const min = Math.min(...data.map((d) => d.balance))
  const max = Math.max(...data.map((d) => d.balance))
  // Where zero sits in the gradient, so the fill turns red below it
  const zeroAt = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min)

  return (
    <section
      style={{
        backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16,
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {p.expired ? t('planner.planEnded').replace('{date}', formatDay(endDate, today)) : t('planner.projectedOn').replace('{date}', formatDay(endDate, today))}
          </p>
          <p
            data-testid="planner-end-balance"
            style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', color: endColor, marginTop: 4 }}
          >
            {fmt(p.end)}
          </p>
        </div>
        <button
          type="button"
          onClick={onEditSettings}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-secondary)',
            fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          <CalendarRange size={14} />
          {t('planner.untilDate').replace('{date}', formatDay(endDate, today))}
        </button>
      </div>

      {p.firstNegativeDay ? (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12, backgroundColor: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
            {t('planner.goesNegative')
              .replace('{date}', formatDay(p.firstNegativeDay, today))
              .replace('{low}', fmt(p.lowest.balance))
              .replace('{lowDate}', formatDay(p.lowest.day, today))}
          </p>
        </div>
      ) : !p.expired && p.days.length > 1 ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <TrendingDown size={14} />
          {t('planner.lowestPoint').replace('{low}', fmt(p.lowest.balance)).replace('{date}', formatDay(p.lowest.day, today))}
        </p>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat
          label={t('planner.startingBalance')}
          value={fmt(p.start)}
          onClick={onEditSettings}
          action={accountCount === 1 ? t('planner.nAccountsOne') : t('planner.nAccounts').replace('{n}', String(accountCount))}
        />
        <Stat label={t('planner.plannedIncome')} value={`+${fmt(p.plannedIncome)}`} color="var(--color-income)" />
        <Stat label={t('planner.plannedExpenses')} value={`-${fmt(p.plannedExpenses)}`} color="var(--color-expense)" />
        {p.scheduledNet !== 0 && (
          <Stat
            label={t('planner.alreadyLogged')}
            value={`${p.scheduledNet > 0 ? '+' : '-'}${fmt(Math.abs(p.scheduledNet))}`}
            color={p.scheduledNet > 0 ? 'var(--color-income)' : 'var(--color-expense)'}
          />
        )}
      </div>

      {data.length > 1 && (
        <div style={{ width: '100%', height: 200 }} aria-label={t('planner.chartLabel')} role="img">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="plannerFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={lineColor} stopOpacity={0.28} />
                  <stop offset={zeroAt} stopColor={lineColor} stopOpacity={0.04} />
                  <stop offset={zeroAt} stopColor={belowColor} stopOpacity={0.08} />
                  <stop offset={1} stopColor={belowColor} stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="plannerStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={zeroAt} stopColor={lineColor} />
                  <stop offset={zeroAt} stopColor={belowColor} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickFormatter={(v) => formatAmountShort(Number(v), currency)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={64} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [fmt(Number(value)), t('planner.balance')]}
                contentStyle={{ borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              {min < 0 && <ReferenceLine y={0} stroke={belowColor} strokeDasharray="4 4" strokeOpacity={0.6} />}
              {/* A gradient on a flat line has no height and draws nothing, so flat lines get a plain colour */}
              <Area type="stepAfter" dataKey="balance" stroke={min < 0 && max > min ? 'url(#plannerStroke)' : min < 0 ? belowColor : lineColor} strokeWidth={2} fill="url(#plannerFill)" isAnimationActive={false} />
              <ReferenceDot x={formatDay(p.lowest.day, today)} y={p.lowest.balance} r={4} fill={p.lowest.balance < 0 ? belowColor : lineColor} stroke="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
