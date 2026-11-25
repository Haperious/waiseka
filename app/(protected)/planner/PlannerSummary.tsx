'use client'

import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { FixSuggestion } from '@/lib/planner/fixSuggestion'
import type { Projection } from '@/lib/planner/projection'
import { FixRow } from './PlannerLowestCard'
import { useTokenColors } from './useTokenColors'
import styles from './planner.module.css'

const CHART_TOKENS = ['--color-accent', '--color-expense'] as const
/** How many evenly spaced day labels sit under the desktop chart. */
const CHART_LABELS = 4

/** The step chart of the running balance: red below zero, dashed zero line, lowest-point dot. */
export function PlannerChart({ projection: p, currency, today, height, compact = false }: {
  projection: Projection
  currency: string
  today: string
  height: number
  /** Sparkline: no tooltip, no labels. */
  compact?: boolean
}) {
  const { t } = useLanguage()
  const id = useId().replace(/:/g, '')
  const [lineColor, belowColor] = useTokenColors(CHART_TOKENS)

  const data = p.days.map((d) => ({ day: d.day, balance: d.balance }))
  if (data.length < 2) return null
  const min = Math.min(...data.map((d) => d.balance))
  const max = Math.max(...data.map((d) => d.balance))
  // Where zero sits in the gradient, so the fill turns red below it
  const zeroAt = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min)

  const last = data.length - 1
  const labelAt = [...new Set(Array.from({ length: CHART_LABELS }, (_, i) => Math.round((i * last) / (CHART_LABELS - 1))))]

  return (
    <div>
      <div style={{ width: '100%', height }} aria-label={t('planner.chartLabel')} role="img">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={`${id}fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={lineColor} stopOpacity={0.28} />
                <stop offset={zeroAt} stopColor={lineColor} stopOpacity={0.06} />
                <stop offset={zeroAt} stopColor={belowColor} stopOpacity={0.12} />
                <stop offset={1} stopColor={belowColor} stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id={`${id}stroke`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroAt} stopColor={lineColor} />
                <stop offset={zeroAt} stopColor={belowColor} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            {!compact && (
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatAmount(Number(value), currency), t('planner.balance')]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(day: any) => formatDay(String(day), today)}
                contentStyle={{ borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            )}
            {min < 0 && <ReferenceLine y={0} stroke={belowColor} strokeDasharray="4 4" strokeOpacity={0.6} />}
            {/* A gradient on a flat line has no height and draws nothing, so flat lines get a plain colour */}
            <Area
              type="stepAfter"
              dataKey="balance"
              stroke={min < 0 && max > min ? `url(#${id}stroke)` : min < 0 ? belowColor : lineColor}
              strokeWidth={2}
              fill={`url(#${id}fill)`}
              isAnimationActive={false}
            />
            {!compact && (
              <ReferenceDot x={p.lowest.day} y={p.lowest.balance} r={4} fill={p.lowest.balance < 0 ? belowColor : lineColor} stroke="none" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className={styles.chartLabels} aria-hidden>
          {labelAt.map((i) => (
            <span key={i}>{data[i].day === today ? t('planner.todayLabel') : formatDay(data[i].day, today)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

interface PlannerSummaryProps {
  projection: Projection
  currency: string
  endDate: string
  today: string
  accountCount: number
  onEditSettings: () => void
}

/** Desktop hero, left: where the balance lands, and the chart. */
export default function PlannerSummary({ projection: p, currency, endDate, today, accountCount, onEditSettings }: PlannerSummaryProps) {
  const { t } = useLanguage()
  const fmt = (n: number) => formatAmount(n, currency)
  const accounts = accountCount === 1 ? t('planner.nAccountsOne') : t('planner.nAccounts').replace('{n}', String(accountCount))

  return (
    <section className={`${styles.heroCard} ${styles.heroLeft}`}>
      <div className={styles.heroTop}>
        <p className={styles.eyebrow}>
          {p.expired ? t('planner.planEnded').replace('{date}', formatDay(endDate, today)) : t('planner.projectedOn').replace('{date}', formatDay(endDate, today))}
        </p>
        <button type="button" className={styles.linkButton} onClick={onEditSettings}>
          {t('planner.fromAccounts').replace('{start}', fmt(p.start)).replace('{accounts}', accounts)}
          <ChevronRight aria-hidden size={13} />
        </button>
      </div>
      <div>
        <p data-testid="planner-end-balance" className={styles.heroNumber} style={p.end < 0 ? { color: 'var(--color-expense)' } : undefined}>
          {fmt(p.end)}
        </p>
        {p.scheduledNet !== 0 && (
          <p className={styles.heroNote}>
            {t('planner.alreadyLogged')}: {p.scheduledNet > 0 ? '+' : '-'}{fmt(Math.abs(p.scheduledNet))}
          </p>
        )}
      </div>
      <PlannerChart projection={p} currency={currency} today={today} height={110} />
    </section>
  )
}

/** Mobile hero: end balance and lowest point side by side, a sparkline, and the fix. */
export function PlannerHeroMobile({ projection: p, currency, endDate, today, fix, onMove }: {
  projection: Projection
  currency: string
  endDate: string
  today: string
  fix: FixSuggestion | null
  onMove: (fix: FixSuggestion) => void
}) {
  const { t } = useLanguage()
  const fmt = (n: number) => formatAmount(n, currency)
  const low = p.lowest.balance

  return (
    <section className={`${styles.heroCard} ${styles.heroMobile}`}>
      <div className={styles.mHeroCols}>
        <div className={styles.mHeroCol}>
          <span className={styles.eyebrow} style={{ fontSize: '0.6rem' }}>
            {p.expired ? t('planner.planEnded').replace('{date}', formatDay(endDate, today)) : formatDay(endDate, today)}
          </span>
          <span data-testid="planner-end-balance" className={styles.mNumber} style={p.end < 0 ? { color: 'var(--color-expense)' } : undefined}>
            {fmt(p.end)}
          </span>
        </div>
        <div className={`${styles.mHeroCol} ${styles.mHeroColDivider}`}>
          <span className={styles.eyebrow} style={{ fontSize: '0.6rem' }}>
            {t('planner.lowestShort').replace('{date}', formatDay(p.lowest.day, today))}
          </span>
          <span className={styles.mNumber} style={{ color: low < 0 ? 'var(--color-expense)' : 'var(--color-accent)' }}>
            {fmt(low)}
          </span>
        </div>
      </div>
      <PlannerChart projection={p} currency={currency} today={today} height={56} compact />
      {fix && <FixRow fix={fix} currency={currency} today={today} short onMove={onMove} />}
    </section>
  )
}
