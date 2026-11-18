'use client'

import { CreditCard, PieChart, Plus, Repeat, Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { PlannerContext, PlannerItem } from '@/lib/planner/types'
import type { TranslationKey } from '@/lib/translations'
import { newItemId } from './ItemForm'

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

const ICON = { recurring: Repeat, budget: PieChart, card: CreditCard } as const

export default function PlannerSuggestions({ suggestions, currency, onAdd }: {
  suggestions: Suggestion[]
  currency: string
  onAdd: (items: PlannerItem[]) => void
}) {
  const { t } = useLanguage()
  if (suggestions.length === 0) return null

  return (
    <section style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          <Sparkles size={15} style={{ color: 'var(--color-accent)' }} />
          {t('planner.suggestions')}
        </h2>
        {suggestions.length > 1 && (
          <Button size="sm" variant="outline" onClick={() => onAdd(suggestions.map((s) => s.item()))}>
            {t('planner.addAll')}
          </Button>
        )}
      </div>
      <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t('planner.suggestionsHint')}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map((s) => {
          const Icon = ICON[s.kind]
          return (
            <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, backgroundColor: 'var(--color-elevated)' }}>
              <Icon size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.detail}</p>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: s.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)' }}>
                {s.type === 'income' ? '+' : '-'}{formatAmount(s.amount, currency)}
              </span>
              <button
                type="button"
                aria-label={t('planner.addSuggestion').replace('{item}', s.title)}
                onClick={() => onAdd([s.item()])}
                style={{ width: 30, height: 30, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-accent)', cursor: 'pointer' }}
              >
                <Plus size={15} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
