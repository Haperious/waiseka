'use client'

import { useState, useMemo, useEffect } from 'react'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Budget } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { useViewCurrency } from '@/context/ViewCurrencyContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { formatAmount, getAllCurrencies, type CurrencyCode } from '@/lib/currency'
import { AmountField, Field, FormModalLayout, Segmented, type SegmentOption } from '@/components/forms/FormParts'
import { BudgetBar } from '@/components/forms/BudgetBar'
import formStyles from '@/components/forms/forms.module.css'

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

type Period = 'monthly' | 'weekly'


/** Same windows the budgets API uses for `spent`: the UTC calendar month, or the UTC week starting Sunday. */
function periodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  if (period === 'weekly') {
    const start = new Date(now)
    start.setUTCDate(now.getUTCDate() - now.getUTCDay())
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    end.setUTCHours(23, 59, 59, 999)
    return { start, end }
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
  }
}

/**
 * Expense total for one category in the current budget period, summed from the
 * transactions list endpoint. Null while loading or when no category is picked.
 */
function useCategorySpend(category: string, period: Period, currency: string | undefined): number | null {
  const [result, setResult] = useState<{ key: string; total: number } | null>(null)
  const key = `${category}|${period}|${currency ?? ''}`

  useEffect(() => {
    if (!category) return
    const controller = new AbortController()
    const { start, end } = periodRange(period)
    const params = new URLSearchParams({
      type: 'expense',
      category,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: '1000',
    })
    if (currency) params.set('currency', currency)
    fetch(`/api/transactions?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { transactions?: { amount: number }[] } | null) => {
        const total = (data?.transactions ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0)
        setResult({ key, total })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [category, period, currency, key])

  return category && result?.key === key ? result.total : null
}

interface BudgetFormProps {
  budget?: Budget
  onSuccess: () => void
  onCancel: () => void
  /** Called when the server rejects creation due to the free-tier budget cap. */
  onCapHit?: () => void
}

/** Create/edit budget form. Render inside <Modal variant="form">. */
export default function BudgetForm({ budget, onSuccess, onCancel, onCapHit }: BudgetFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const periodOptions: SegmentOption<Period>[] = [
    { value: 'monthly', label: t('budgetForm.monthly') },
    { value: 'weekly', label: t('budgetForm.weekly') },
  ]
  const { categories } = useCategories()
  const { viewCurrency, currencies, isMultiCurrency } = useViewCurrency()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    // New budgets default to the currency being viewed (PRD Phase 4)
    currency: budget?.currency ?? viewCurrency,
    category: budget?.category ?? '',
    limit: budget?.limit ? String(budget.limit) : '',
    period: budget?.period ?? 'monthly',
    color: budget?.color ?? COLORS[0],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Single-currency users have everything in the primary currency
  const budgetCurrency = isMultiCurrency ? form.currency : primaryCurrency
  const spent = useCategorySpend(form.category, form.period, isMultiCurrency ? form.currency : undefined)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.category) e.category = t('form.errCategory')
    if (!form.limit || isNaN(Number(form.limit)) || Number(form.limit) <= 0)
      e.limit = t('budgetForm.errLimit')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const url = budget ? `/api/budgets/${budget._id}` : '/api/budgets'
      const method = budget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        // Single-currency users never pick one: the server defaults to the primary
        body: JSON.stringify({
          ...form,
          limit: Number(form.limit),
          currency: isMultiCurrency ? form.currency : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403 && onCapHit) {
          onCancel()
          onCapHit()
        } else {
          toast(data.error ?? t('budgetForm.failed'), 'error')
        }
      } else {
        toast(budget ? t('budgetForm.updated') : t('budgetForm.created'), 'success')
        onSuccess()
      }
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = useMemo(
    () => categories
      .filter((c) => c.type === 'expense' || c.type === 'both')
      .map((c) => ({ value: c.name, label: c.name })),
    [categories]
  )

  const currencyInfo = new Map(getAllCurrencies().map((c) => [c.code, c]))
  const currencyOptions = currencies.map((code) => ({
    value: code,
    label: `${currencyInfo.get(code)?.flag ?? ''} ${code} (${currencyInfo.get(code)?.symbol ?? ''})`,
  }))

  const limitNumber = Number(form.limit) || 0
  const money = (v: number) => formatAmount(v, budgetCurrency)

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {budget ? t('budgetForm.update') : t('budgetForm.create')}
          </Button>
        </>
      }
    >
      {isMultiCurrency && (
        <Select
          tone="token"
          label={t('form.currency')}
          value={form.currency}
          onValueChange={(v) => setForm({ ...form, currency: v as CurrencyCode })}
          options={currencyOptions}
        />
      )}

      <Select
        tone="token"
        label={t('common.category')}
        value={form.category}
        onValueChange={(v) => setForm({ ...form, category: v })}
        options={categoryOptions}
        placeholder={t('form.selectCategory')}
        error={errors.category}
      />

      <AmountField
        id="budget-limit"
        label={t('budgetForm.limit')}
        value={form.limit}
        onChange={(limit) => setForm({ ...form, limit })}
        currency={budgetCurrency}
        error={errors.limit}
      />

      <div className={formStyles.twoCol}>
        <Field label={t('budgetForm.period')}>
          <Segmented
            ariaLabel={t('budgetForm.period')}
            options={periodOptions}
            value={form.period}
            onChange={(period) => setForm({ ...form, period })}
          />
        </Field>
        <Field label={t('budgetForm.colour')}>
          <div className={formStyles.swatches} role="radiogroup" aria-label={t('budgetForm.colour')}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setForm({ ...form, color: c })}
                className={formStyles.swatch}
                style={{
                  backgroundColor: c,
                  boxShadow: form.color === c ? `0 0 0 2px var(--color-card), 0 0 0 4px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className={formStyles.paleBlock}>
        <span className={formStyles.eyebrow}>
          {form.period === 'weekly' ? t('budgetForm.previewWeek') : t('budgetForm.previewMonth')}
        </span>
        {form.category ? (
          <BudgetBar
            name={form.category}
            color={form.color}
            spent={spent ?? 0}
            limit={limitNumber}
            formatAmount={money}
          />
        ) : (
          <span className={formStyles.hint}>{t('budgetForm.previewEmpty')}</span>
        )}
      </div>
    </FormModalLayout>
  )
}
