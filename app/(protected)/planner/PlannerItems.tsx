'use client'

import { useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { Switch } from '@/components/forms/FormParts'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount } from '@/lib/currency'
import { formatDay } from '@/lib/planner/days'
import type { Projection, ResolvedItem } from '@/lib/planner/projection'
import type { PlannerItem, PlannerItemType } from '@/lib/planner/types'
import type { TranslationKey } from '@/lib/translations'
import styles from './planner.module.css'

export interface ItemActions {
  onAdd: (type: PlannerItemType) => void
  onToggle: (item: PlannerItem) => void
  onEdit: (item: PlannerItem) => void
  onDone: (item: PlannerItem, done: boolean) => void
  onRemove: (item: PlannerItem) => void
}

interface PlannerItemsProps extends ItemActions {
  items: PlannerItem[]
  projection: Projection
  currency: string
  today: string
  endDate: string
}

const SOURCE_BADGE: Partial<Record<PlannerItem['source'], TranslationKey>> = {
  budget: 'planner.sourceBudget',
  card: 'planner.sourceCard',
  recurring: 'planner.sourceRecurring',
}

function iconButton(label: string, onClick: () => void, icon: React.ReactNode, tone: 'default' | 'danger' = 'default', className?: string) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
        border: 'none', background: 'none', cursor: 'pointer',
        color: tone === 'danger' ? 'var(--color-expense)' : 'var(--color-text-muted)',
      }}
    >
      {icon}
    </button>
  )
}

/** "Due Nov 20", "Spread to Nov 30", "No date · counted today", plus why it isn't counted. */
function describe(item: PlannerItem, r: ResolvedItem | undefined, t: (k: TranslationKey) => string, today: string, endDate: string): { when: string; note?: string } {
  const day = (d: string) => formatDay(d, today)
  let when: string
  if (item.source === 'budget') when = r?.spread ? t('planner.spreadTo').replace('{date}', day(r.spread.to)) : t('planner.thisMonth')
  else if (item.source === 'card') when = r?.day ? t('planner.dueOn').replace('{date}', day(r.day)) : t('planner.noDueDay')
  else if (!item.date) when = item.type === 'income' ? t('planner.noDateIncome').replace('{date}', day(endDate)) : t('planner.noDateExpense')
  else when = r?.overdue ? t('planner.wasDue').replace('{date}', day(item.date)) : day(item.date)

  const status = r?.status
  const note =
    status === 'off' ? t('planner.statusOff')
      : status === 'afterEnd' ? t('planner.statusAfterEnd')
        : status === 'unavailable' ? t('planner.statusUnavailable')
          : status === 'coveredByAccounts' ? t('planner.statusCovered')
            : status === 'nothingLeft' ? (item.source === 'card' ? t('planner.statusNothingOwed') : t('planner.statusSpent'))
              : undefined
  return { when, note }
}

function ItemRow({ item, resolved, currency, today, endDate, onToggle, onEdit, onDone, onRemove }: {
  item: PlannerItem
  resolved: ResolvedItem | undefined
  currency: string
  today: string
  endDate: string
} & Omit<ItemActions, 'onAdd'>) {
  const { t } = useLanguage()
  const counted = resolved?.status === 'counted'
  const { when, note } = describe(item, resolved, t, today, endDate)
  const badge = SOURCE_BADGE[item.source]
  const amount = resolved?.amount ?? item.amount
  const sign = item.type === 'income' ? '+' : '-'
  const label = item.note ? `${item.category} · ${item.note}` : item.category

  return (
    <li
      data-testid="planner-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--color-border)',
      }}
    >
      <Switch checked={item.enabled} onChange={() => onToggle(item)} label={t('planner.countThis').replace('{item}', label)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${t('common.edit')}: ${label}`}
          onClick={() => onEdit(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(item) } }}
          style={{ cursor: 'pointer' }}
        >
          <p
            title={label}
            style={{
              fontSize: '0.86rem', fontWeight: 600, color: counted ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              // Two lines at most, so long notes stay readable on a phone
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
            }}
          >
            {label}
          </p>
          <p style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: resolved?.overdue ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: 2 }}>
            {badge && (
              <span style={{ padding: '1px 7px', borderRadius: 999, backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {t(badge)}
              </span>
            )}
            <span>{when}</span>
            {note && <span>· {note}</span>}
          </p>
        </div>
        {resolved?.possibleMatch && counted && (
          <p style={{ fontSize: '0.72rem', color: 'var(--color-accent)', marginTop: 3 }}>
            {t('planner.looksLogged')}{' '}
            <button type="button" onClick={() => onDone(item, true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 700, textDecoration: 'underline', fontSize: 'inherit' }}>
              {t('planner.markDone')}
            </button>
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: '0.88rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          color: !counted ? 'var(--color-text-muted)' : item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
          textDecoration: counted ? undefined : 'line-through',
        }}
      >
        {sign}{formatAmount(amount, currency)}
      </span>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {iconButton(t('planner.markDone'), () => onDone(item, true), <Check size={15} />)}
        {iconButton(t('common.edit'), () => onEdit(item), <Pencil size={14} />, 'default', styles.hideNarrow)}
        {iconButton(t('planner.remove'), () => onRemove(item), <Trash2 size={14} />, 'danger')}
      </div>
    </li>
  )
}

function Group({ title, type, list, ...rest }: {
  title: string
  type: PlannerItemType
  list: PlannerItem[]
} & Omit<PlannerItemsProps, 'items'>) {
  const { t } = useLanguage()
  const total = list.reduce((sum, i) => (rest.projection.items[i.id]?.status === 'counted' ? sum + (rest.projection.items[i.id]?.amount ?? 0) : sum), 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
          {title}
          <span style={{ marginLeft: 8, fontWeight: 600, color: type === 'income' ? 'var(--color-income)' : 'var(--color-expense)', textTransform: 'none', letterSpacing: 0 }}>
            {type === 'income' ? '+' : '-'}{formatAmount(total, rest.currency)}
          </span>
        </h3>
        <Button size="sm" variant="ghost" onClick={() => rest.onAdd(type)}>
          <Plus size={14} style={{ marginRight: 4 }} />
          {type === 'income' ? t('planner.addIncome') : t('planner.addExpense')}
        </Button>
      </div>
      {list.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '10px 4px' }}>
          {type === 'income' ? t('planner.noIncome') : t('planner.noExpenses')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((item) => (
            <ItemRow key={item.id} item={item} resolved={rest.projection.items[item.id]} {...rest} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Overdue items: still counted today until the user says what happened. */
export function NeedsALook({ items, projection, today, currency, onDone, onEdit, onRemove }: PlannerItemsProps) {
  const { t } = useLanguage()
  const overdue = items.filter((i) => projection.items[i.id]?.overdue)
  if (overdue.length === 0) return null
  return (
    <section style={{ border: '1px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', borderRadius: 16, padding: '16px 18px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} />
        {t('planner.needsALook')}
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{t('planner.needsALookHint')}</p>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {overdue.map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {item.note ? `${item.category} · ${item.note}` : item.category}
                <span style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums', color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)' }}>
                  {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount, currency)}
                </span>
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-warning)', marginTop: 2 }}>
                {t('planner.overdueQuestion').replace('{date}', formatDay(item.date ?? today, today))}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button size="sm" onClick={() => onDone(item, true)}>{t('planner.yesDone')}</Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(item)}>{t('planner.changeDate')}</Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(item)} style={{ color: 'var(--color-expense)' }}>{t('planner.drop')}</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function PlannerItems(props: PlannerItemsProps) {
  const { t } = useLanguage()
  const [showDone, setShowDone] = useState(false)
  const open = props.items.filter((i) => !i.done)
  const done = props.items.filter((i) => i.done)
  const byDate = (a: PlannerItem, b: PlannerItem) =>
    (props.projection.items[a.id]?.day ?? a.date ?? '9999').localeCompare(props.projection.items[b.id]?.day ?? b.date ?? '9999')

  return (
    <section style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Group title={t('planner.income')} type="income" list={open.filter((i) => i.type === 'income').sort(byDate)} {...props} />
      <Group title={t('planner.expenses')} type="expense" list={open.filter((i) => i.type === 'expense').sort(byDate)} {...props} />

      {done.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}
          >
            {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t('planner.doneCount').replace('{n}', String(done.length))}
          </button>
          {showDone && (
            <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
              {done.map((item) => (
                <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>
                  <Check size={14} style={{ color: 'var(--color-income)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.note ? `${item.category} · ${item.note}` : item.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
                    {item.type === 'income' ? '+' : '-'}{formatAmount(props.projection.items[item.id]?.amount ?? item.amount, props.currency)}
                  </span>
                  {iconButton(t('planner.undoDone'), () => props.onDone(item, false), <Undo2 size={14} />)}
                  {iconButton(t('planner.remove'), () => props.onRemove(item), <Trash2 size={14} />, 'danger')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
