'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Lightbulb } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Goal } from '@/hooks/useGoals'
import { useViewCurrency } from '@/context/ViewCurrencyContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { getAllCurrencies, type CurrencyCode } from '@/lib/currency'
import { countCutoffsBetween, cutoffPrefsFor } from '@/lib/services/cutoff'
import { usePreferences } from '@/hooks/usePreferences'
import {
  AmountField,
  Field,
  FormModalLayout,
  Segmented,
  moneyLabel,
  type SegmentOption,
} from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'


const NAME_SUGGESTIONS = ['Emergency Fund', 'Boracay trip', 'New laptop', 'Pang-Pasko']

/** Round up to the next ₱50 so the per-cutoff amount is easy to set aside. */
const ROUND_TO = 50

interface GoalFormProps {
  goal?: Goal
  onSuccess: () => void
  onCancel: () => void
  /** Called when the server rejects creation due to the free-tier active-goal cap. */
  onCapHit?: () => void
}

/** Create/edit goal form. Render inside <Modal variant="form">. */
export default function GoalForm({ goal, onSuccess, onCancel, onCapHit }: GoalFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const priorityOptions: SegmentOption<Goal['priority']>[] = [
    { value: 'low', label: t('goalForm.low') },
    { value: 'medium', label: t('goalForm.medium') },
    { value: 'high', label: t('goalForm.high') },
  ]
  const statusOptions: SegmentOption<Goal['status']>[] = [
    { value: 'active', label: t('goalForm.active') },
    { value: 'paused', label: t('goalForm.paused') },
    { value: 'completed', label: t('goalForm.completed') },
  ]
  const { viewCurrency, currencies, isMultiCurrency } = useViewCurrency()
  const { currency: primaryCurrency } = useCurrency()
  const { preferences } = usePreferences()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    currency: goal?.currency ?? viewCurrency,
    title: goal?.title ?? '',
    targetAmount: goal?.targetAmount ? String(goal.targetAmount) : '',
    savedAmount: goal?.savedAmount != null ? String(goal.savedAmount) : '',
    // Date only (yyyy-MM-dd); sent as the end of that local day so the goal is due through the whole day
    deadline: goal?.deadline ? format(new Date(goal.deadline), 'yyyy-MM-dd') : '',
    priority: goal?.priority ?? 'medium',
    status: goal?.status ?? 'active',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const goalCurrency = isMultiCurrency ? form.currency : primaryCurrency

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = t('goalForm.errTitle')
    if (!form.targetAmount || isNaN(Number(form.targetAmount)) || Number(form.targetAmount) <= 0)
      e.targetAmount = t('goalForm.errTarget')
    if (!form.deadline) e.deadline = t('goalForm.errDeadline')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const url = goal ? `/api/goals/${goal._id}` : '/api/goals'
      const method = goal ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        title: form.title,
        targetAmount: Number(form.targetAmount),
        priority: form.priority,
        status: form.status,
        deadline: new Date(`${form.deadline}T23:59:59`).toISOString(),
      }
      // Single-currency users never pick one: the server defaults new goals to the primary
      if (isMultiCurrency) payload.currency = form.currency
      if (goal && form.savedAmount !== '') {
        payload.savedAmount = Number(form.savedAmount)
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403 && onCapHit) {
          onCancel()
          onCapHit()
        } else {
          toast(data.error ?? t('goalForm.failed'), 'error')
        }
      } else {
        toast(goal ? t('goalForm.updated') : t('goalForm.created'), 'success')
        onSuccess()
      }
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  // Projection: how much to set aside each payday to hit the target by the deadline
  const target = Number(form.targetAmount) || 0
  const current = Number(form.savedAmount) || 0
  const deadline = form.deadline ? new Date(`${form.deadline}T00:00:00`) : null
  const remaining = target - current
  // Paydays follow the user's own cutoff schedule for this goal's currency (Settings → Money)
  const cutoffs =
    deadline && !isNaN(deadline.getTime())
      ? countCutoffsBetween(cutoffPrefsFor(preferences, goalCurrency), new Date(), deadline)
      : 0
  const showProjection = target > 0 && remaining > 0 && cutoffs > 0
  const perCutoff = showProjection ? Math.ceil(remaining / cutoffs / ROUND_TO) * ROUND_TO : 0

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {goal ? t('goalForm.update') : t('goalForm.create')}
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
          options={currencies.map((code) => {
            const info = getAllCurrencies().find((c) => c.code === code)
            return { value: code, label: `${info?.flag ?? ''} ${code} (${info?.symbol ?? ''})` }
          })}
        />
      )}

      <div className={formStyles.field}>
        <Input
          id="goal-title"
          label={t('goalForm.name')}
          placeholder={t('goalForm.namePlaceholder')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          error={errors.title}
        />
        <div className={formStyles.suggestions}>
          {NAME_SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className={formStyles.suggestChip}
              onClick={() => setForm({ ...form, title: name })}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <AmountField
        id="goal-target"
        label={t('goalForm.target')}
        value={form.targetAmount}
        onChange={(targetAmount) => setForm({ ...form, targetAmount })}
        currency={goalCurrency}
        error={errors.targetAmount}
      />

      {goal && (
        <Input
          id="goal-saved"
          label={t('goalForm.saved')}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.savedAmount}
          onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
        />
      )}

      <div className={formStyles.twoCol}>
        <Input
          id="goal-deadline"
          label={t('goalForm.date')}
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          error={errors.deadline}
        />
        <Field label={t('goalForm.priority')}>
          <Segmented
            ariaLabel={t('goalForm.priority')}
            options={priorityOptions}
            value={form.priority}
            onChange={(priority) => setForm({ ...form, priority })}
          />
        </Field>
      </div>

      {goal && (
        <Field label={t('goalForm.status')}>
          <Segmented
            ariaLabel={t('goalForm.status')}
            options={statusOptions}
            value={form.status}
            onChange={(status) => setForm({ ...form, status })}
          />
        </Field>
      )}

      {showProjection && deadline && (
        <div className={formStyles.projection} aria-live="polite">
          <Lightbulb size={16} />
          <span>
            {t('goalForm.projectionLead')}{' '}
            <strong>
              {t('goalForm.projectionPer').replace('{amount}', moneyLabel(perCutoff, goalCurrency, { whole: true }))}
            </strong>{' '}
            {t('goalForm.projectionRest')
              .replace('{target}', moneyLabel(target, goalCurrency, { whole: Number.isInteger(target) }))
              .replace('{date}', format(deadline, 'MMM d, yyyy'))
              .replace('{n}', String(cutoffs))
              .replace('{unit}', cutoffs === 1 ? t('goalForm.sweldo') : t('goalForm.sweldos'))}
          </span>
        </div>
      )}
    </FormModalLayout>
  )
}
