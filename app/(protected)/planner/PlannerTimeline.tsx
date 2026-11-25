'use client'

import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { Projection } from '@/lib/planner/projection'
import styles from './planner.module.css'

/**
 * The running balance day by day: days where something happens, plus the first and last.
 * A budget's daily share is folded into one line. Planned items select on click; real
 * transactions already logged are plain text.
 */
export default function PlannerTimeline({ projection, currency, today, compact = false, onSelect }: {
  projection: Projection
  currency: string
  today: string
  /** Mobile: day + balance on top, lines underneath. */
  compact?: boolean
  onSelect: (itemId: string) => void
}) {
  const { t } = useLanguage()
  const fmt = (n: number) => formatAmount(n, currency)
  const signed = (n: number) => `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n))}`
  const last = projection.days.length - 1

  if (projection.days.length <= 1 && projection.days[0]?.events.length === 0) return null

  const rows = projection.days
    .map((d, i) => ({
      ...d,
      named: d.events.filter((e) => !e.spread),
      spread: d.events.filter((e) => e.spread).reduce((s, e) => s + e.amount, 0),
      index: i,
    }))
    .filter((d) => d.index === 0 || d.index === last || d.named.length > 0)

  return (
    <section className={styles.daysCard} aria-label={t('planner.dayByDay')}>
      <ol className={styles.daysList}>
        {rows.map((d) => {
          const negative = d.balance < 0
          const dayText = d.day === today ? t('planner.todayLabel') : formatDay(d.day, today)
          const lines = (
            <ul className={styles.dayLines}>
              {d.named.map((e) => (
                <li key={`${e.kind}-${e.id}`}>
                  {e.kind === 'item' ? (
                    <button type="button" className={styles.dayLine} onClick={() => onSelect(e.id)}>
                      <span className={styles.dayLineLabel}>{e.label}</span>
                      <span className={styles.dayLineAmount} style={{ color: e.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>{signed(e.amount)}</span>
                    </button>
                  ) : (
                    <span className={styles.dayLine} style={{ cursor: 'default' }}>
                      <span className={styles.dayLineLabel}>
                        {e.label}
                        <em className={styles.loggedTag}>{t('planner.logged')}</em>
                      </span>
                      <span className={styles.dayLineAmount} style={{ color: e.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>{signed(e.amount)}</span>
                    </span>
                  )}
                </li>
              ))}
              {d.spread !== 0 && (
                <li>
                  <span className={styles.dayLine} style={{ cursor: 'default' }}>
                    <span className={styles.dayLineLabel}>{t('planner.budgetShare')}</span>
                    <span className={styles.dayLineAmount} style={{ color: 'var(--color-expense)' }}>-{fmt(Math.abs(d.spread))}</span>
                  </span>
                </li>
              )}
            </ul>
          )
          const balance = (
            <span className={styles.dayBalance} style={negative ? { color: 'var(--color-expense)' } : undefined}>{fmt(d.balance)}</span>
          )
          const dayName = (
            <span className={styles.dayName} style={negative ? { color: 'var(--color-expense)' } : undefined}>{dayText}</span>
          )
          return (
            <li key={d.day} className={`${compact ? styles.dayRowCompact : styles.dayRow} ${negative ? styles.dayRowNegative : ''}`}>
              {compact ? (
                <>
                  <div className={styles.dayTop}>{dayName}{balance}</div>
                  {lines}
                </>
              ) : (
                <>{dayName}{lines}{balance}</>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
