'use client'

import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { FixSuggestion } from '@/lib/planner/fixSuggestion'
import { itemLabel, type Projection } from '@/lib/planner/projection'
import styles from './planner.module.css'

/** "Padala (₱5,000) lands on Nov 14, before your Salary on Nov 15. Move it there?" + Move it. */
export function FixRow({ fix, currency, today, short = false, onMove }: {
  fix: FixSuggestion
  currency: string
  today: string
  short?: boolean
  onMove: (fix: FixSuggestion) => void
}) {
  const { t } = useLanguage()
  const day = (d: string) => formatDay(d, today)
  const text = short
    ? t('planner.fixShort')
      .replace('{item}', itemLabel(fix.item))
      .replace('{day}', day(fix.toDay))
      .replace('{income}', fix.income.category)
    : t('planner.fixMove')
      .replace('{item}', itemLabel(fix.item))
      .replace('{amount}', formatAmount(fix.item.amount, currency))
      .replace('{day}', day(fix.fromDay))
      .replace('{income}', fix.income.category)
      .replace('{incomeDay}', day(fix.toDay))

  return (
    <div className={styles.fixRow}>
      <p className={styles.fixText}>{text}</p>
      <Button size="sm" variant="outline" className={styles.fixButton} onClick={() => onMove(fix)}>
        {t('planner.moveIt')}
      </Button>
    </div>
  )
}

/** Desktop hero, right: the lowest point, one concrete fix, and planned totals. */
export default function PlannerLowestCard({ projection: p, currency, today, fix, onMove }: {
  projection: Projection
  currency: string
  today: string
  fix: FixSuggestion | null
  onMove: (fix: FixSuggestion) => void
}) {
  const { t } = useLanguage()
  const fmt = (n: number) => formatAmount(n, currency)
  const low = p.lowest.balance

  return (
    <section className={`${styles.heroCard} ${styles.heroRight}`}>
      <div className={styles.heroTop}>
        <p className={styles.eyebrow}>{t('planner.lowestTitle')}</p>
        <span className={styles.datePill}>{p.lowest.day === today ? t('planner.todayLabel') : formatDay(p.lowest.day, today)}</span>
      </div>
      <p className={styles.heroNumber} style={{ lineHeight: 0.95, letterSpacing: '-0.025em', color: low < 0 ? 'var(--color-expense)' : 'var(--color-accent)' }}>
        {fmt(low)}
      </p>
      {fix ? (
        <FixRow fix={fix} currency={currency} today={today} onMove={onMove} />
      ) : !p.firstNegativeDay ? (
        <p className={styles.heroHint}>{t('planner.staysPositive')}</p>
      ) : null}
      <div className={styles.tiles}>
        <div className={styles.tile} style={{ borderLeftColor: 'var(--color-income)' }}>
          <span className={styles.tileLabel}>{t('planner.plannedIncome')}</span>
          <span className={styles.tileValue} style={{ color: 'var(--color-income)' }}>+{fmt(p.plannedIncome)}</span>
        </div>
        <div className={styles.tile} style={{ borderLeftColor: 'var(--color-expense)' }}>
          <span className={styles.tileLabel}>{t('planner.plannedExpenses')}</span>
          <span className={styles.tileValue} style={{ color: 'var(--color-expense)' }}>-{fmt(p.plannedExpenses)}</span>
        </div>
      </div>
    </section>
  )
}
