'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Transaction } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import MicrophoneButton from '@/components/MicrophoneButton'

interface TransactionFormProps {
  transaction?: Transaction
  onSuccess: () => void
  onCancel: () => void
}

export default function TransactionForm({ transaction, onSuccess, onCancel }: TransactionFormProps) {
  const { toast } = useToast()
  const { categories } = useCategories()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: (transaction?.type ?? 'expense') as 'income' | 'expense' | 'savings',
    amount: transaction?.amount ? String(transaction.amount) : '',
    category: transaction?.category ?? '',
    description: transaction?.description ?? '',
    date: transaction?.date ? format(new Date(transaction.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    isRecurring: transaction?.isRecurring ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = 'Enter a valid positive amount'
    if (!form.category) e.category = 'Category is required'
    if (!form.date) e.date = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const url = transaction ? `/api/transactions/${transaction._id}` : '/api/transactions'
      const method = transaction ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast(data.error ?? 'Failed to save transaction', 'error')
      } else {
        toast(transaction ? 'Transaction updated' : 'Transaction added', 'success')
        onSuccess()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter(
      (c) => c.type === form.type || c.type === 'both' || form.type === 'savings'
    )
    return filtered.map((c) => ({ value: c.name, label: c.name }))
  }, [categories, form.type])

  const typeOptions = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'savings', label: '🏦 Savings' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="pb-3 border-b border-gray-100 dark:border-gray-700">
        <MicrophoneButton
          onFill={(data) =>
            setForm((prev) => ({
              ...prev,
              ...(data.type && { type: data.type, category: '' }),
              ...(data.amount !== undefined && { amount: String(data.amount) }),
              ...(data.category && { category: data.category }),
              ...(data.description && { description: data.description }),
            }))
          }
        />
      </div>
      <Select
        label="Type"
        value={form.type}
        onValueChange={(v) => setForm({ ...form, type: v as 'income' | 'expense' | 'savings', category: '' })}
        options={typeOptions}
      />
      <Input
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        error={errors.amount}
      />
      <Select
        label="Category"
        value={form.category}
        onValueChange={(v) => setForm({ ...form, category: v })}
        options={categoryOptions}
        placeholder="Select category"
        error={errors.category}
      />
      <Input
        label="Description (optional)"
        placeholder="What was this for?"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        label="Date"
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
        error={errors.date}
      />
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isRecurring}
          onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
          className="rounded border-gray-300"
        />
        Recurring transaction
      </label>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={loading}>
          {transaction ? 'Update' : 'Add'} Transaction
        </Button>
      </div>
    </form>
  )
}
