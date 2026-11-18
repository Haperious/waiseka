'use client'

import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { Projection } from '@/lib/planner/projection'

/**
 * The running balance day by day. By default only days where something happens (plus
 * the first and last) are listed; a budget's daily share is folded into one line.
 */
export default function PlannerTimeline({ projection, currency, today }: { projection: Projection; currency: string; today: string }) {
  const { t } = useLanguage()
  const [everyDay, setEveryDay] = useState(false)
  const fmt = (n: number) => formatAmount(n, currency)
  const last = projection.days.length - 1

  const rows = projection.days
    .map((d, i) => {
      const named = d.events.filter((e) => !e.spread)
      const spread = d.events.filter((e) => e.spread).reduce((s, e) => s + e.amount, 0)
      return { ...d, named, spread, index: i }
    })
    .filter((d) => everyDay || d.index === 0 || d.index === last || d.named.length > 0)

  if (projection.days.length <= 1 && projection.days[0]?.events.length === 0) return null

  return (
    <section style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{t('planner.dayByDay')}</h2>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={everyDay} onChange={(e) => setEveryDay(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
          {t('planner.showEveryDay')}
        </label>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((d) => (
          <li key={d.day} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {d.day === today ? t('planner.todayLabel') : formatDay(d.day, today)}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: d.balance < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)' }}>
                {fmt(d.balance)}
              </span>
            </div>
            {(d.named.length > 0 || d.spread !== 0) && (
              <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {d.named.map((e) => (
                  <li key={`${e.kind}-${e.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.label}
                      {e.kind === 'scheduled' && <em style={{ marginLeft: 6, fontStyle: 'normal', color: 'var(--color-accent)' }}>{t('planner.logged')}</em>}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: e.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {e.amount >= 0 ? '+' : '-'}{fmt(Math.abs(e.amount))}
                    </span>
                  </li>
                ))}
                {d.spread !== 0 && (
                  <li style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    <span>{t('planner.budgetShare')}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-expense)' }}>-{fmt(Math.abs(d.spread))}</span>
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
