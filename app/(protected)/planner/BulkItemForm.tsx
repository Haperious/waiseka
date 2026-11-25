'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, TrendingDown, TrendingUp, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { FormModalLayout, moneyLabel, sanitizeAmount } from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'
import { getCurrencySymbol } from '@/lib/currency'
import { useCategories } from '@/hooks/useCategories'
import { useLanguage } from '@/context/LanguageContext'
import { MAX_PLANNER_NOTE } from '@/lib/constants'
import { buildBulkItems, bulkTotals, isBlankRow, type BulkRow, type BulkRowErrors } from '@/lib/planner/bulk'
import type { PlannerItem, PlannerItemType } from '@/lib/planner/types'
import { newItemId } from './ItemForm'
import styles from './planner.module.css'

/** Empty rows shown when the form opens. */
const START_ROWS = 3

interface BulkItemFormProps {
  defaultType?: PlannerItemType
  currency: string
  maxDate: string
  /** How many more items the plan can take. */
  room: number
  onSave: (items: PlannerItem[]) => void
  onCancel: () => void
}

function blankRow(type: PlannerItemType): BulkRow {
  return { key: newItemId(), type, amount: '', category: '', note: '', date: '' }
}

/** Add many planned income and expense rows at once. Render inside <Modal variant="form">. */
export default function BulkItemForm({ defaultType = 'expense', currency, maxDate, room, onSave, onCancel }: BulkItemFormProps) {
  const { t } = useLanguage()
  const { categories } = useCategories()
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: Math.max(1, Math.min(START_ROWS, room)) }, () => blankRow(defaultType)),
  )
  const [errors, setErrors] = useState<Record<string, BulkRowErrors>>({})
  const amountRefs = useRef(new Map<string, HTMLInputElement>())
  const focusKey = useRef<string | null>(null)

  const byType = useMemo(() => ({
    income: categories.filter((c) => c.type === 'income' || c.type === 'both'),
    expense: categories.filter((c) => c.type === 'expense' || c.type === 'both'),
  }), [categories])

  const totals = bulkTotals(rows)
  const filled = rows.filter((r) => !isBlankRow(r)).length
  const atRoom = rows.length >= room

  const patch = (key: string, p: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)))
    // Clear only the errors of the fields just changed
    if (errors[key]) {
      setErrors((prev) => {
        const rest = { ...prev[key] }
        for (const f of Object.keys(p)) delete rest[f as keyof BulkRowErrors]
        const next = { ...prev }
        if (Object.keys(rest).length > 0) next[key] = rest
        else delete next[key]
        return next
      })
    }
  }

  const addRow = (after?: BulkRow) => {
    if (atRoom) return
    // A new row starts as the same type as the one above it
    const row = blankRow(after?.type ?? rows[rows.length - 1]?.type ?? defaultType)
    focusKey.current = row.key
    setRows((prev) => [...prev, row])
  }

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : [blankRow(prev[0].type)]))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const flipType = (r: BulkRow) => {
    const type: PlannerItemType = r.type === 'income' ? 'expense' : 'income'
    const keep = byType[type].some((c) => c.name === r.category)
    patch(r.key, { type, ...(keep ? {} : { category: '' }) })
  }

  /** Enter moves to the next row's amount (adding a row at the end) instead of submitting. */
  const onEnter = (e: React.KeyboardEvent, r: BulkRow) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    const i = rows.findIndex((x) => x.key === r.key)
    const next = rows[i + 1]
    if (next) amountRefs.current.get(next.key)?.focus()
    else addRow(r)
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const { items, errors: e } = buildBulkItems(rows, {
      maxDate,
      messages: { amount: t('form.errAmount'), category: t('form.errCategory'), date: t('planner.errDate') },
    })
    setErrors(e)
    const firstBad = rows.find((r) => e[r.key])
    if (firstBad) {
      amountRefs.current.get(firstBad.key)?.focus()
      return
    }
    if (items.length > 0) onSave(items)
  }

  const label = filled > 0
    ? (filled === 1 ? t('planner.bulkSaveOne') : t('planner.bulkSave').replace('{n}', String(filled)))
    : t('planner.addItems')

  return (
    <FormModalLayout
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className={formStyles.money} disabled={filled === 0}>
            {label}
          </Button>
        </>
      }
    >
      <p className={formStyles.hint} style={{ lineHeight: 1.5 }}>{t('planner.bulkHint')}</p>

      <div className={styles.bulkHead} aria-hidden>
        <span />
        <span>{t('common.amount')}</span>
        <span>{t('common.category')}</span>
        <span>{t('common.date')}</span>
        <span>{t('form.note')}</span>
        <span />
      </div>

      <ol className={styles.bulkRows}>
        {rows.map((r, i) => {
          const err = errors[r.key] ?? {}
          const income = r.type === 'income'
          const n = i + 1
          const options = byType[r.type]
          return (
            <li key={r.key} className={styles.bulkRow}>
              <button
                type="button"
                className={styles.bulkType}
                style={{
                  color: income ? 'var(--color-income)' : 'var(--color-expense)',
                  backgroundColor: income ? 'var(--color-income-bg)' : 'var(--color-expense-bg)',
                }}
                aria-label={t('planner.bulkTypeToggle').replace('{n}', String(n)).replace('{type}', income ? t('planner.income') : t('planner.expense'))}
                title={income ? t('planner.income') : t('planner.expense')}
                onClick={() => flipType(r)}
              >
                {income ? <TrendingUp size={15} aria-hidden /> : <TrendingDown size={15} aria-hidden />}
                <span className={styles.bulkTypeText}>{income ? t('planner.income') : t('planner.expense')}</span>
              </button>

              <div className={`${styles.bulkAmount} ${err.amount ? styles.bulkInvalid : ''}`}>
                <span className={styles.bulkSymbol} aria-hidden>{getCurrencySymbol(currency)}</span>
                <input
                  ref={(el) => {
                    if (el) {
                      amountRefs.current.set(r.key, el)
                      if (focusKey.current === r.key) {
                        focusKey.current = null
                        el.focus()
                      }
                    } else {
                      amountRefs.current.delete(r.key)
                    }
                  }}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  aria-label={t('planner.bulkAmountLabel').replace('{n}', String(n))}
                  aria-invalid={!!err.amount || undefined}
                  autoFocus={i === 0}
                  value={r.amount}
                  onChange={(e) => patch(r.key, { amount: sanitizeAmount(e.target.value) })}
                  onKeyDown={(e) => onEnter(e, r)}
                />
              </div>

              <select
                className={`${styles.bulkField} ${styles.bulkCategory} ${err.category ? styles.bulkInvalid : ''}`}
                aria-label={t('planner.bulkCategoryLabel').replace('{n}', String(n))}
                aria-invalid={!!err.category || undefined}
                value={r.category}
                onChange={(e) => patch(r.key, { category: e.target.value })}
              >
                <option value="">{t('planner.bulkPickCategory')}</option>
                {options.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <input
                type="date"
                className={`${styles.bulkField} ${styles.bulkDate} ${err.date ? styles.bulkInvalid : ''}`}
                aria-label={t('planner.bulkDateLabel').replace('{n}', String(n))}
                aria-invalid={!!err.date || undefined}
                max={maxDate}
                value={r.date}
                onChange={(e) => patch(r.key, { date: e.target.value })}
                onKeyDown={(e) => onEnter(e, r)}
              />

              <input
                type="text"
                className={`${styles.bulkField} ${styles.bulkNote}`}
                aria-label={t('planner.bulkNoteLabel').replace('{n}', String(n))}
                placeholder={t('form.note')}
                maxLength={MAX_PLANNER_NOTE}
                value={r.note}
                onChange={(e) => patch(r.key, { note: e.target.value })}
                onKeyDown={(e) => onEnter(e, r)}
              />

              <button
                type="button"
                className={styles.bulkRemove}
                aria-label={t('planner.bulkRemoveRow').replace('{n}', String(n))}
                onClick={() => removeRow(r.key)}
              >
                <X size={15} aria-hidden />
              </button>

              {(err.amount || err.category || err.date) && (
                <span className={`${formStyles.errorText} ${styles.bulkError}`} role="alert">
                  {[err.amount, err.category, err.date].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className={styles.bulkFooterRow}>
        <Button type="button" variant="ghost" size="sm" disabled={atRoom} onClick={() => addRow()}>
          <Plus aria-hidden size={14} style={{ marginRight: 4 }} />
          {t('planner.bulkAddRow')}
        </Button>
        {atRoom && <span className={formStyles.hint}>{t('planner.tooManyItems')}</span>}
        {totals.count > 0 && (
          <span className={styles.bulkTotals}>
            {totals.income > 0 && <span style={{ color: 'var(--color-income)' }}>+{moneyLabel(totals.income, currency)}</span>}
            {totals.expense > 0 && <span style={{ color: 'var(--color-expense)' }}>-{moneyLabel(totals.expense, currency)}</span>}
          </span>
        )}
      </div>
    </FormModalLayout>
  )
}
