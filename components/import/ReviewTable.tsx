'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { ITransaction } from '@/lib/models/Transaction'

type Row = Partial<ITransaction> & { _key: string }

const CATEGORY_OPTIONS = [
  'Food & Dining', 'Transport', 'Shopping', 'Bills & Utilities',
  'Salary', 'Savings', 'Transfer', 'Health', 'Subscriptions', 'Others',
]

const TYPE_OPTIONS: { value: ITransaction['type']; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
]

interface ReviewTableProps {
  transactions: Partial<ITransaction>[]
  onConfirm: (selected: Partial<ITransaction>[]) => void
  loading?: boolean
}

export default function ReviewTable({ transactions, onConfirm, loading }: ReviewTableProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((t, i) => ({ ...t, _key: `${i}` }))
  )
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(transactions.map((_, i) => `${i}`))
  )
  const [filterType, setFilterType] = useState<'all' | ITransaction['type']>('all')

  const update = (key: string, field: keyof ITransaction, value: unknown) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }

  const toggleAll = () => {
    const visible = filtered.map((r) => r._key)
    const allChecked = visible.every((k) => checked.has(k))
    setChecked((prev) => {
      const next = new Set(prev)
      visible.forEach((k) => (allChecked ? next.delete(k) : next.add(k)))
      return next
    })
  }

  const totalIncome = rows.filter((r) => r.type === 'income').reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalExpenses = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + (r.amount ?? 0), 0)

  const filtered = filterType === 'all' ? rows : rows.filter((r) => r.type === filterType)
  const selectedCount = [...checked].filter((k) => rows.find((r) => r._key === k)).length

  const handleConfirm = () => {
    const selected = rows.filter((r) => checked.has(r._key)).map(({ _key, ...t }) => t)
    onConfirm(selected)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
          <TrendingUp className="mx-auto mb-1 h-4 w-4 text-green-600" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Income</p>
          <p className="text-sm font-semibold text-green-600">{totalIncome.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
          <TrendingDown className="mx-auto mb-1 h-4 w-4 text-red-500" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
          <p className="text-sm font-semibold text-red-500">{totalExpenses.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
          <PiggyBank className="mx-auto mb-1 h-4 w-4 text-blue-500" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-sm font-semibold text-blue-500">{rows.length} txns</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['all', 'income', 'expense', 'savings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px',
              filterType === t
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((r) => checked.has(r._key))}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-2 py-2 text-left text-gray-500 dark:text-gray-400">Date</th>
              <th className="px-2 py-2 text-left text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-2 py-2 text-left text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-2 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-2 py-2 text-right text-gray-500 dark:text-gray-400">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((row) => (
              <tr
                key={row._key}
                className={cn(
                  'transition-colors',
                  checked.has(row._key)
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-gray-50/60 dark:bg-gray-800/60 opacity-50'
                )}
              >
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked.has(row._key)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev)
                        next.has(row._key) ? next.delete(row._key) : next.add(row._key)
                        return next
                      })
                    }
                    className="rounded"
                  />
                </td>
                <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {row.date ? String(row.date).split('T')[0] : '—'}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={row.description ?? ''}
                    onChange={(e) => update(row._key, 'description', e.target.value)}
                    className="w-full min-w-[140px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs px-2 py-1 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={row.category ?? 'Others'}
                    onChange={(e) => update(row._key, 'category', e.target.value)}
                    className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none text-xs px-2 py-1 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={row.type ?? 'expense'}
                    onChange={(e) => update(row._key, 'type', e.target.value as ITransaction['type'])}
                    className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none text-xs px-2 py-1 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    value={row.amount ?? 0}
                    min={0}
                    step="0.01"
                    onChange={(e) => update(row._key, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-20 text-right bg-transparent text-gray-900 dark:text-white outline-none focus:bg-gray-50 dark:focus:bg-gray-800 rounded px-1 py-0.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={handleConfirm} loading={loading} disabled={selectedCount === 0}>
        Add {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} →
      </Button>
    </div>
  )
}
