'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Budget } from '@/hooks/useBudgets'

const CATEGORIES = [
  'Food & Dining', 'Transportation', 'Housing', 'Entertainment',
  'Health & Fitness', 'Shopping', 'Utilities', 'Education',
  'Travel', 'Personal Care', 'Gifts & Donations', 'Business', 'Other',
]

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

interface BudgetFormProps {
  budget?: Budget
  onSuccess: () => void
  onCancel: () => void
}

export default function BudgetForm({ budget, onSuccess, onCancel }: BudgetFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category: budget?.category ?? '',
    limit: budget?.limit ? String(budget.limit) : '',
    period: budget?.period ?? 'monthly',
    color: budget?.color ?? COLORS[0],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.category) e.category = 'Category is required'
    if (!form.limit || isNaN(Number(form.limit)) || Number(form.limit) <= 0)
      e.limit = 'Enter a valid positive limit'
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
        body: JSON.stringify({ ...form, limit: Number(form.limit) }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error ?? 'Failed to save budget', 'error')
      } else {
        toast(budget ? 'Budget updated' : 'Budget created', 'success')
        onSuccess()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Category"
        value={form.category}
        onValueChange={(v) => setForm({ ...form, category: v })}
        options={categoryOptions}
        placeholder="Select category"
        error={errors.category}
      />
      <Input
        label="Budget Limit"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.limit}
        onChange={(e) => setForm({ ...form, limit: e.target.value })}
        error={errors.limit}
      />
      <Select
        label="Period"
        value={form.period}
        onValueChange={(v) => setForm({ ...form, period: v as 'monthly' | 'weekly' })}
        options={PERIOD_OPTIONS}
      />
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                backgroundColor: c,
                boxShadow: form.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
              }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {budget ? 'Update' : 'Create'} Budget
        </Button>
      </div>
    </form>
  )
}
