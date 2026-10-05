'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Goal } from '@/hooks/useGoals'
import { useViewCurrency } from '@/context/ViewCurrencyContext'
import { getAllCurrencies, type CurrencyCode } from '@/lib/currency'

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
]

interface GoalFormProps {
  goal?: Goal
  onSuccess: () => void
  onCancel: () => void
  /** Called when the server rejects creation due to the free-tier active-goal cap. */
  onCapHit?: () => void
}

export default function GoalForm({ goal, onSuccess, onCancel, onCapHit }: GoalFormProps) {
  const { toast } = useToast()
  const { viewCurrency, currencies, isMultiCurrency } = useViewCurrency()
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isMultiCurrency && (
        <Select
          label="Currency"
          value={form.currency}
          onValueChange={(v) => setForm({ ...form, currency: v as CurrencyCode })}
          options={currencies.map((code) => {
            const info = getAllCurrencies().find((c) => c.code === code)
            return { value: code, label: `${info?.flag ?? ''} ${code} (${info?.symbol ?? ''})` }
          })}
        />
      )}
      <Input
        label="Goal Title"
        placeholder="e.g. Emergency Fund"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        error={errors.title}
      />
      <Input
        label="Target Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.targetAmount}
        onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
        error={errors.targetAmount}
      />
      {goal && (
        <Input
          label="Current Savings"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.savedAmount}
          onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
        />
      )}
      <Input
        label="Deadline"
        type="datetime-local"
        value={form.deadline}
        onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        error={errors.deadline}
      />
      <Select
        label="Priority"
        value={form.priority}
        onValueChange={(v) => setForm({ ...form, priority: v as Goal['priority'] })}
        options={PRIORITY_OPTIONS}
      />
      {goal && (
        <Select
          label="Status"
          value={form.status}
          onValueChange={(v) => setForm({ ...form, status: v as Goal['status'] })}
          options={STATUS_OPTIONS}
        />
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {goal ? 'Update' : 'Create'} Goal
        </Button>
      </div>
    </form>
  )
}
