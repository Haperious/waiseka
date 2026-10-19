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
import { getAllCurrencies, type CurrencyCode } from '@/lib/currency'
import { countCutoffsUntil } from '@/lib/cutoffs'
import {
  AmountField,
  Field,
  FormModalLayout,
  Segmented,
  moneyLabel,
  type SegmentOption,
} from '@/components/forms/FormParts'
import formStyles from '@/components/forms/forms.module.css'

const PRIORITY_OPTIONS: SegmentOption<Goal['priority']>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
]

const STATUS_OPTIONS: SegmentOption<Goal['status']>[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
]

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
  const { viewCurrency, currencies, isMultiCurrency } = useViewCurrency()
  const { currency: primaryCurrency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    currency: goal?.currency ?? viewCurrency,
    title: goal?.title ?? '',
    targetAmount: goal?.targetAmount ? String(goal.targetAmount) : '',
    savedAmount: goal?.savedAmount != null ? String(goal.savedAmount) : '',
    deadline: goal?.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd'T'HH:mm") : '',
    priority: goal?.priority ?? 'medium',
    status: goal?.status ?? 'active',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const goalCurrency = isMultiCurrency ? form.currency : primaryCurrency

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.targetAmount || isNaN(Number(form.targetAmount)) || Number(form.targetAmount) <= 0)
      e.targetAmount = 'Enter a valid target amount'
    if (!form.deadline) e.deadline = 'Deadline is required'
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
        deadline: form.deadline,
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
          toast(data.error ?? 'Failed to save goal', 'error')
        }
      } else {
        toast(goal ? 'Goal updated' : 'Goal created', 'success')
        onSuccess()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Projection: how much to set aside each payday to hit the target by the deadline
  const target = Number(form.targetAmount) || 0
  const current = Number(form.savedAmount) || 0
  const deadline = form.deadline ? new Date(form.deadline) : null
  const remaining = target - current
  const cutoffs = deadline && !isNaN(deadline.getTime()) ? countCutoffsUntil(deadline) : 0
  const showProjection = target > 0 && remaining > 0 && cutoffs > 0
  const perCutoff = showProjection ? Math.ceil(remaining / cutoffs / ROUND_TO) * ROUND_TO : 0

  return (
    <FormModalLayout
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {goal ? 'Update goal' : 'Create goal'}
          </Button>
        </>
      }
    >
      {isMultiCurrency && (
        <Select
          tone="token"
          label="Currency"
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
          label="What are you saving for?"
          placeholder="e.g. Emergency Fund"
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
        label="Target amount"
        value={form.targetAmount}
        onChange={(targetAmount) => setForm({ ...form, targetAmount })}
        currency={goalCurrency}
        error={errors.targetAmount}
      />

      {goal && (
        <Input
          id="goal-saved"
          label="Current savings"
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
          label="Target date"
          type="datetime-local"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          error={errors.deadline}
        />
        <Field label="Priority">
          <Segmented
            ariaLabel="Priority"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(priority) => setForm({ ...form, priority })}
          />
        </Field>
      </div>

      {goal && (
        <Field label="Status">
          <Segmented
            ariaLabel="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(status) => setForm({ ...form, status })}
          />
        </Field>
      )}

      {showProjection && deadline && (
        <div className={formStyles.projection} aria-live="polite">
          <Lightbulb size={16} />
          <span>
            Set aside about <strong>{moneyLabel(perCutoff, goalCurrency, { whole: true })} per cutoff</strong> to reach{' '}
            {moneyLabel(target, goalCurrency, { whole: Number.isInteger(target) })} by {format(deadline, 'MMM d, yyyy')}. That&apos;s {cutoffs}{' '}
            {cutoffs === 1 ? 'sweldo' : 'sweldos'} from now.
          </span>
        </div>
      )}
    </FormModalLayout>
  )
}
