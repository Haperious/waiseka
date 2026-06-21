'use client'

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useCategories } from '@/hooks/useCategories'
import { useCurrency } from '@/context/CurrencyContext'

interface BulkTransactionFormProps {
  onSuccess: () => void
  onCancel: () => void
}

interface TransactionRow {
  id: string
  type: 'income' | 'expense' | 'savings'
  amount: string
  category: string
  description: string
}

type RowErrors = Record<string, string>

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'savings', label: 'Savings' },
]

function createEmptyRow(): TransactionRow {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: '',
    category: '',
    description: '',
  }
}

export default function BulkTransactionForm({ onSuccess, onCancel }: BulkTransactionFormProps) {
  const { toast } = useToast()
  const { categories } = useCategories()
  const { currency } = useCurrency()

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rows, setRows] = useState<TransactionRow[]>([createEmptyRow(), createEmptyRow()])
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({})
  const [loading, setLoading] = useState(false)

  const categoryOptionsFor = useCallback(
    (type: TransactionRow['type']) => {
      const filtered = categories.filter(
        (c) => c.type === type || c.type === 'both' || type === 'savings'
      )
      return filtered.map((c) => ({ value: c.name, label: c.name }))
    },
    [categories]
  )

  const updateRow = useCallback((id: string, patch: Partial<TransactionRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, ...patch }
        if (patch.type && patch.type !== r.type) updated.category = ''
        return updated
      })
    )
    setRowErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev[id] }
      Object.keys(patch).forEach((k) => delete next[k])
      return { ...prev, [id]: next }
    })
  }, [])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()])
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const validate = (): boolean => {
    const errors: Record<string, RowErrors> = {}
    for (const row of rows) {
      const e: RowErrors = {}
      if (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0)
        e.amount = 'Required'
      if (!row.category) e.category = 'Required'
      if (Object.keys(e).length > 0) errors[row.id] = e
    }
    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!date) {
      toast('Please select a date', 'error')
      return
    }
    if (!validate()) {
      toast('Fix the highlighted fields before submitting', 'error')
      return
    }
    setLoading(true)
    try {
      const transactions = rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        category: r.category,
        description: r.description,
        date,
        currency,
      }))

      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 422 && data.validationErrors) {
          const errors: Record<string, RowErrors> = {}
          for (const ve of data.validationErrors) {
            const row = rows[ve.index]
            if (row) errors[row.id] = ve.fields
          }
          setRowErrors(errors)
          toast('Fix the highlighted fields before submitting', 'error')
        } else {
          toast(data.error ?? 'Failed to save transactions', 'error')
        }
        return
      }

      toast(`${data.inserted} transaction${data.inserted !== 1 ? 's' : ''} added`, 'success')
      onSuccess()
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  const hasErrors = Object.keys(rowErrors).some(
    (id) => Object.keys(rowErrors[id] ?? {}).length > 0
  )

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="max-w-xs flex-shrink-0">
        <Input
          label="Date (applies to all transactions)"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1 pr-1">
        {rows.map((row, index) => {
          const errors = rowErrors[row.id] ?? {}
          const hasRowError = Object.keys(errors).length > 0
          const catOptions = categoryOptionsFor(row.type)

          return (
            <div
              key={row.id}
              className={[
                'rounded-xl border p-3 transition-colors',
                hasRowError
                  ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                  : 'border-[var(--color-border)] bg-[var(--color-elevated)]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Type"
                  value={row.type}
                  onValueChange={(v) => updateRow(row.id, { type: v as TransactionRow['type'] })}
                  options={TYPE_OPTIONS}
                />
                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                  error={errors.amount}
                />
                <Select
                  label="Category"
                  value={row.category}
                  onValueChange={(v) => updateRow(row.id, { category: v })}
                  options={catOptions}
                  placeholder="Select category"
                  error={errors.category}
                />
                <Input
                  label="Description (optional)"
                  placeholder="What was this for?"
                  value={row.description}
                  onChange={(e) => updateRow(row.id, { description: e.target.value })}
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:opacity-80 transition-opacity self-start flex-shrink-0"
      >
        <Plus className="h-4 w-4" />
        Add another transaction
      </button>

      {hasErrors && (
        <p className="text-sm text-red-500 flex-shrink-0">
          Some rows have missing fields highlighted above.
        </p>
      )}

      <div className="flex gap-3 pt-1 border-t border-[var(--color-border)] flex-shrink-0">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="flex-1" loading={loading} onClick={handleSubmit}>
          Save {rows.length} Transaction{rows.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  )
}
