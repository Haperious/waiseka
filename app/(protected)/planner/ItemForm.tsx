'use client'

import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { AmountField, CategoryChips, Field, FormModalLayout, Segmented, moneyLabel } from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'
import { useCategories } from '@/hooks/useCategories'
import { useLanguage } from '@/context/LanguageContext'
import { MAX_PLANNER_NOTE as MAX_ITEM_NOTE } from '@/lib/constants'
import type { PlannerItem, PlannerItemType } from '@/lib/planner/types'

export function newItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

interface ItemFormProps {
  /** Editing this item; a new one when absent. */
  item?: PlannerItem
  defaultType?: PlannerItemType
  currency: string
  /** Live amount shown for budget and card items (they can't be typed over). */
  liveAmount?: number
  minDate: string
  maxDate: string
  onSave: (item: PlannerItem) => void
  onCancel: () => void
  /** Editing a fixed item: log it as a real transaction. */
  onLog?: (item: PlannerItem) => void
}

/** Add or edit one planned income or expense. Render inside <Modal variant="form">. */
export default function ItemForm({ item, defaultType = 'expense', currency, liveAmount, minDate, maxDate, onSave, onCancel, onLog }: ItemFormProps) {
  const { t } = useLanguage()
  const { categories } = useCategories()
  const live = item?.source === 'budget' || item?.source === 'card'

  const [type, setType] = useState<PlannerItemType>(item?.type ?? defaultType)
  const [amount, setAmount] = useState(item && !live ? String(item.amount) : '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [date, setDate] = useState(item?.date ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === type || c.type === 'both'),
    [categories, type],
  )

  const build = (): PlannerItem | null => {
    const e: Record<string, string> = {}
    const n = Number(amount)
    if (!live && (!amount || !Number.isFinite(n) || n <= 0)) e.amount = t('form.errAmount')
    if (!category.trim()) e.category = t('form.errCategory')
    if (date && (date < '1900-01-01' || date > maxDate)) e.date = t('planner.errDate')
    setErrors(e)
    if (Object.keys(e).length > 0) return null
    return {
      id: item?.id ?? newItemId(),
      type: live ? 'expense' : type,
      amount: live ? 0 : Math.round(n * 100) / 100,
      category: category.trim(),
      ...(note.trim() ? { note: note.trim() } : {}),
      date: live ? null : date || null,
      enabled: item?.enabled ?? true,
      done: item?.done ?? false,
      source: item?.source ?? 'manual',
      ...(item?.sourceRef ? { sourceRef: item.sourceRef } : {}),
    }
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const built = build()
    if (built) onSave(built)
  }

  const n = Number(amount)
  const verb = item ? t('planner.saveItem') : type === 'income' ? t('planner.addIncome') : t('planner.addExpense')
  const label = !live && amount && n > 0 ? `${verb} · ${moneyLabel(n, currency)}` : verb

  return (
    <FormModalLayout
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className={formStyles.money}>
            {label}
          </Button>
        </>
      }
    >
      {!live && (
        <Segmented<PlannerItemType>
          ariaLabel={t('planner.itemType')}
          value={type}
          onChange={(v) => {
            setType(v)
            setCategory('')
          }}
          options={[
            { value: 'expense', icon: TrendingDown, label: t('planner.expense'), color: 'var(--color-expense)' },
            { value: 'income', icon: TrendingUp, label: t('planner.income'), color: 'var(--color-income)' },
          ]}
        />
      )}

      {live ? (
        <Field label={t('common.amount')} hint={item?.source === 'budget' ? t('planner.liveBudgetHint') : t('planner.liveCardHint')}>
          <div className={formStyles.amountBox}>
            <span className={formStyles.amountInput} style={{ cursor: 'default' }}>
              {moneyLabel(liveAmount ?? 0, currency)}
            </span>
          </div>
        </Field>
      ) : (
        <AmountField
          id="planner-amount"
          label={t('common.amount')}
          value={amount}
          onChange={setAmount}
          currency={currency}
          error={errors.amount}
          autoFocus={!item}
        />
      )}

      {live ? (
        <Field label={t('common.category')}>
          <span style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{category}</span>
        </Field>
      ) : (
        <CategoryChips categories={typeCategories} value={category} onChange={setCategory} error={errors.category} />
      )}

      <Input
        id="planner-note"
        label={t('form.note')}
        placeholder={t('planner.notePlaceholder')}
        value={note}
        maxLength={MAX_ITEM_NOTE}
        onChange={(e) => setNote(e.target.value)}
      />

      {!live && (
        <Field
          label={t('common.date')}
          htmlFor="planner-date"
          error={errors.date}
          hint={date ? (date < minDate ? t('planner.dateOverdueHint') : undefined) : t('planner.noDateHint')}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="planner-date"
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10, fontSize: '0.88rem',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-input, var(--color-card))',
                color: 'var(--color-text-primary)',
              }}
            />
            {date && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDate('')}>
                {t('planner.noDate')}
              </Button>
            )}
          </div>
        </Field>
      )}

      {item && onLog && !live && !item.done && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const built = build()
            if (built) onLog(built)
          }}
        >
          {t('planner.logAsTransaction')}
        </Button>
      )}
    </FormModalLayout>
  )
}
