'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, Undo2 } from 'lucide-react'
import { Switch } from '@/components/forms/FormParts'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { describe, SOURCE_BADGE } from '@/lib/planner/describe'
import { itemLabel, type Projection, type ResolvedItem } from '@/lib/planner/projection'
import type { PlannerItem, PlannerItemType } from '@/lib/planner/types'
import styles from './planner.module.css'

export interface ItemActions {
  onAdd: (type: PlannerItemType) => void
  onSelect: (item: PlannerItem) => void
  onToggle: (item: PlannerItem) => void
  onDone: (item: PlannerItem, done: boolean) => void
  onRemove: (item: PlannerItem) => void
}

interface PlannerItemsProps extends ItemActions {
  items: PlannerItem[]
  projection: Projection
  currency: string
  today: string
  endDate: string
  selectedId: string | null
  /** Mobile: one card for the active tab, with a lighter header. */
  only?: PlannerItemType
}

const TYPE_COLOR: Record<PlannerItemType, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
}

function ItemRow({ item, resolved, currency, today, endDate, selected, onSelect, onToggle, onDone }: {
  item: PlannerItem
  resolved: ResolvedItem | undefined
  currency: string
  today: string
  endDate: string
  selected: boolean
} & Pick<ItemActions, 'onSelect' | 'onToggle' | 'onDone'>) {
  const { t } = useLanguage()
  const counted = resolved?.status === 'counted'
  const { when, note } = describe(item, resolved, t, today, endDate)
  const badge = SOURCE_BADGE[item.source]
  const sub = [badge ? t(badge) : null, when, note].filter(Boolean).join(' · ')
  const amount = resolved?.amount ?? item.amount
  const label = itemLabel(item)

  return (
    <li data-testid="planner-item" className={`${styles.row} ${selected ? styles.rowSelected : ''}`}>
      <Switch checked={item.enabled} onChange={() => onToggle(item)} label={t('planner.countThis').replace('{item}', label)} />
      <div className={styles.rowMain}>
        <button type="button" aria-pressed={selected} className={styles.rowButton} onClick={() => onSelect(item)}>
          <span className={styles.rowText}>
            <span className={styles.rowLabel} title={label} style={counted ? undefined : { color: 'var(--color-text-muted)' }}>{label}</span>
            <span className={styles.rowSub} style={resolved?.overdue ? { color: 'var(--color-warning)' } : undefined}>{sub}</span>
          </span>
          <span
            className={styles.rowAmount}
            style={counted ? { color: TYPE_COLOR[item.type] } : { color: 'var(--color-text-muted)', textDecoration: 'line-through' }}
          >
            {item.type === 'income' ? '+' : '-'}{formatAmount(amount, currency)}
          </span>
        </button>
        {resolved?.possibleMatch && counted && (
          <p className={styles.rowMatch}>
            {t('planner.looksLogged')}{' '}
            <button type="button" className={styles.inlineLink} onClick={() => onDone(item, true)}>
              {t('planner.markDone')}
            </button>
          </p>
        )}
      </div>
    </li>
  )
}

function DoneList({ done, projection, currency, onDone, onRemove }: {
  done: PlannerItem[]
  projection: Projection
  currency: string
} & Pick<ItemActions, 'onDone' | 'onRemove'>) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  if (done.length === 0) return null
  return (
    <div className={styles.doneFooter}>
      <button type="button" className={styles.doneToggle} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown aria-hidden size={14} /> : <ChevronRight aria-hidden size={14} />}
        {t('planner.doneCount').replace('{n}', String(done.length))}
      </button>
      {open && (
        <ul className={styles.doneList}>
          {done.map((item) => (
            <li key={item.id} className={styles.doneRow}>
              <span className={styles.doneLabel}>{itemLabel(item)}</span>
              <span className={styles.doneAmount}>
                {item.type === 'income' ? '+' : '-'}{formatAmount(projection.items[item.id]?.amount ?? item.amount, currency)}
              </span>
              <button type="button" className={styles.smallIcon} aria-label={t('planner.undoDone')} title={t('planner.undoDone')} onClick={() => onDone(item, false)}>
                <Undo2 aria-hidden size={14} />
              </button>
              <button type="button" className={`${styles.smallIcon} ${styles.smallIconDanger}`} aria-label={t('planner.remove')} title={t('planner.remove')} onClick={() => onRemove(item)}>
                <Trash2 aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListCard({ type, list, done, compact, ...rest }: {
  type: PlannerItemType
  list: PlannerItem[]
  done: PlannerItem[]
  compact: boolean
} & Omit<PlannerItemsProps, 'items' | 'only'>) {
  const { t } = useLanguage()
  const { projection } = rest
  const total = list.reduce((sum, i) => (projection.items[i.id]?.status === 'counted' ? sum + (projection.items[i.id]?.amount ?? 0) : sum), 0)
  const title = type === 'income' ? t('planner.income') : t('planner.expenses')

  return (
    <section className={styles.listCard} style={{ borderLeftColor: TYPE_COLOR[type] }} aria-label={title}>
      <div className={styles.listHeader}>
        <div style={{ minWidth: 0 }}>
          {!compact && <h2 className={styles.eyebrow}>{title}</h2>}
          <p className={styles.listTotal} style={{ color: TYPE_COLOR[type] }}>
            {type === 'income' ? '+' : '-'}{formatAmount(total, rest.currency)}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-label={type === 'income' ? t('planner.addIncome') : t('planner.addExpense')}
          onClick={() => rest.onAdd(type)}
        >
          <Plus aria-hidden size={14} style={{ marginRight: 4 }} />
          {t('planner.addShort')}
        </Button>
      </div>
      {list.length === 0 ? (
        <p className={styles.listEmpty}>{type === 'income' ? t('planner.noIncome') : t('planner.noExpenses')}</p>
      ) : (
        <ul className={styles.rows}>
          {list.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              resolved={projection.items[item.id]}
              currency={rest.currency}
              today={rest.today}
              endDate={rest.endDate}
              selected={item.id === rest.selectedId}
              onSelect={rest.onSelect}
              onToggle={rest.onToggle}
              onDone={rest.onDone}
            />
          ))}
        </ul>
      )}
      <DoneList done={done} projection={projection} currency={rest.currency} onDone={rest.onDone} onRemove={rest.onRemove} />
    </section>
  )
}

/** Income and Expenses as two striped cards (desktop), or one of them (mobile tab). */
export default function PlannerItems({ items, only, ...rest }: PlannerItemsProps) {
  const byDate = (a: PlannerItem, b: PlannerItem) =>
    (rest.projection.items[a.id]?.day ?? a.date ?? '9999').localeCompare(rest.projection.items[b.id]?.day ?? b.date ?? '9999')
  const card = (type: PlannerItemType) => (
    <ListCard
      key={type}
      type={type}
      list={items.filter((i) => i.type === type && !i.done).sort(byDate)}
      done={items.filter((i) => i.type === type && i.done)}
      compact={!!only}
      {...rest}
    />
  )
  if (only) return card(only)
  return <div className={styles.board}>{card('income')}{card('expense')}</div>
}
