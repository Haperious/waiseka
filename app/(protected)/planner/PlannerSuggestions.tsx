'use client'

import { useId, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { PlannerContext, PlannerItem } from '@/lib/planner/types'
import type { TranslationKey } from '@/lib/translations'
import { newItemId } from './ItemForm'
import styles from './planner.module.css'

export interface Suggestion {
  key: string
  kind: 'recurring' | 'budget' | 'card'
  title: string
  detail: string
  amount: number
  type: 'income' | 'expense'
  item: () => PlannerItem
}

/**
 * Items the user's own data points at, minus anything already in the plan:
 * recurring entries not logged yet this month, budgets with money left, and bills for
 * cards that aren't part of the starting balance (paying a picked card doesn't change it).
 */
export function buildSuggestions(
  context: PlannerContext,
  scenario: { items: PlannerItem[]; accountIds: string[]; endDate: string; currency: string },
  t: (k: TranslationKey) => string,
): Suggestion[] {
  const taken = new Set(scenario.items.filter((i) => i.sourceRef).map((i) => `${i.source}:${i.sourceRef}`))
  const picked = new Set(scenario.accountIds)
  const today = context.today
  const out: Suggestion[] = []

  for (const s of context.suggestions) {
    if (taken.has(`recurring:${s.key}`) || s.date > scenario.endDate) continue
    out.push({
      key: `recurring:${s.key}`,
      kind: 'recurring',
      title: s.note ? `${s.category} · ${s.note}` : s.category,
      detail: t('planner.suggestRecurring').replace('{date}', formatDay(s.date, today)),
      amount: s.amount,
      type: s.type,
      item: () => ({
        id: newItemId(), type: s.type, amount: s.amount, category: s.category, ...(s.note ? { note: s.note } : {}),
        date: s.date, enabled: true, done: false, source: 'recurring', sourceRef: s.key,
      }),
    })
  }
  for (const b of context.budgets) {
    if (taken.has(`budget:${b.id}`) || b.remaining <= 0) continue
    out.push({
      key: `budget:${b.id}`,
      kind: 'budget',
      title: b.category,
      detail: t('planner.suggestBudget').replace('{spent}', formatAmount(b.spent, scenario.currency)).replace('{limit}', formatAmount(b.limit, scenario.currency)),
      amount: b.remaining,
      type: 'expense',
      item: () => ({
        id: newItemId(), type: 'expense', amount: 0, category: b.category, date: null, enabled: true, done: false, source: 'budget', sourceRef: b.id,
      }),
    })
  }
  for (const c of context.cards) {
    if (taken.has(`card:${c.id}`) || picked.has(c.id) || c.outstanding <= 0 || !c.dueDate || c.dueDate > scenario.endDate) continue
    out.push({
      key: `card:${c.id}`,
      kind: 'card',
      title: c.name,
      detail: t('planner.suggestCard').replace('{date}', formatDay(c.dueDate, today)),
      amount: c.outstanding,
      type: 'expense',
      item: () => ({
        id: newItemId(), type: 'expense', amount: 0, category: c.name, note: t('planner.cardBillNote'), date: null,
        enabled: true, done: false, source: 'card', sourceRef: c.id,
      }),
    })
  }
  return out
}

/**
 * Banner with what the user's data suggests: count + first names, Review/Hide for the
 * full list (desktop), and Add all.
 */
export default function PlannerSuggestions({ suggestions, currency, compact = false, onAdd }: {
  suggestions: Suggestion[]
  currency: string
  /** Mobile: one row, no Review. */
  compact?: boolean
  onAdd: (items: PlannerItem[]) => void
}) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  if (suggestions.length === 0) return null

  const count = suggestions.length === 1
    ? t('planner.suggestCountOne')
    : t('planner.suggestCount').replace('{n}', String(suggestions.length))
  const names = suggestions.slice(0, 3).map((s) => s.title).join(', ')
  const open = expanded && !compact

  return (
    <section className={styles.banner} aria-label={t('planner.suggestions')}>
      <div className={styles.bannerRow}>
        <Sparkles aria-hidden size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        <p className={styles.bannerText}>
          <strong>{count}</strong>
          {!compact && <span className={styles.bannerNames}> {names}</span>}
        </p>
        {!compact && (
          <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
            {open ? t('planner.hide') : t('planner.review')}
          </Button>
        )}
        <Button size="sm" className={styles.bannerAddAll} onClick={() => onAdd(suggestions.map((s) => s.item()))}>
          {t('planner.addAll')}
        </Button>
      </div>
      {open && (
        <ul id={listId} className={styles.bannerGrid}>
          {suggestions.map((s) => (
            <li key={s.key} className={styles.sugCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className={styles.sugTitle} title={s.title}>{s.title}</p>
                <p className={styles.sugSub}>
                  {s.type === 'income' ? '+' : '-'}{formatAmount(s.amount, currency)} · {s.detail}
                </p>
              </div>
              <button
                type="button"
                className={styles.sugAdd}
                aria-label={t('planner.addSuggestion').replace('{item}', s.title)}
                onClick={() => onAdd([s.item()])}
              >
                <Plus aria-hidden size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
