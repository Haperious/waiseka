'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, TrendingUp, TrendingDown, PiggyBank, Pencil, Trash2, Download, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { useTransactions, Transaction } from '@/hooks/useTransactions'
import { useCurrency } from '@/context/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import TransactionForm from './TransactionForm'

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
]

export default function TransactionsPage() {
  const { formatAmount, currency } = useCurrency()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { transactions, total, totalPages, loading, deleteTransaction, refetch } = useTransactions({
    type: filterType === 'all' ? '' : filterType,
    search,
    startDate,
    endDate,
    page,
    limit: 15,
  })

  const handleDelete = async () => {
    if (!deleteTx) return
    try {
      await deleteTransaction(deleteTx._id)
      toast('Transaction deleted', 'success')
      setDeleteTx(null)
    } catch {
      toast('Failed to delete transaction', 'error')
    }
  }

  const exportCSV = () => {
    const headers = [`Date,Type,Category,Description,Amount (${currency}),Tags`]
    const rows = transactions.map((t) =>
      [
        format(new Date(t.date), 'yyyy-MM-dd'),
        t.type,
        t.category,
        `"${t.description ?? ''}"`,
        t.amount.toFixed(2),
        `"${t.tags.join('; ')}"`,
      ].join(',')
    )
    const csv = [...headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} total records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm pl-9 pr-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) }}}
              />
            </div>
            <div className="w-32 sm:w-36 shrink-0">
              <Select
                value={filterType}
                onValueChange={(v) => { setFilterType(v); setPage(1) }}
                options={TYPE_OPTIONS}
                placeholder="Type"
              />
            </div>
            <Button variant="outline" size="md" onClick={() => setShowFilters((v) => !v)} className="shrink-0">
              <Filter className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Date Filter'}</span>
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 gap-2 mt-3 sm:flex sm:flex-wrap sm:gap-3">
              <Input
                type="date"
                label="From"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              />
              <Input
                type="date"
                label="To"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              />
              <div className="col-span-2 flex sm:items-end">
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setFilterType('all'); setSearch(''); setSearchInput(''); setPage(1) }}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</th>
                <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="text-right px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="px-3 sm:px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6">
                      <SkeletonRow />
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No transactions found</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs sm:text-sm">
                      {format(new Date(tx.date), 'MMM d')}
                      <span className="hidden sm:inline">, {format(new Date(tx.date), 'yyyy')}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-900 dark:text-white max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm">
                      {tx.description || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell text-sm">{tx.category}</td>
                    <td className="px-3 sm:px-6 py-3 hidden md:table-cell">
                      <Badge variant={tx.type === 'income' ? 'success' : tx.type === 'savings' ? 'savings' : 'danger'}>
                        {tx.type === 'income' ? (
                          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Income</span>
                        ) : tx.type === 'savings' ? (
                          <span className="flex items-center gap-1"><PiggyBank className="h-3 w-3" />Savings</span>
                        ) : (
                          <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />Expense</span>
                        )}
                      </Badge>
                    </td>
                    <td
                      className={`px-3 sm:px-6 py-3 text-right font-semibold whitespace-nowrap text-xs sm:text-sm ${tx.type === 'income' ? 'text-green-600' : tx.type === 'savings' ? '' : 'text-red-600'}`}
                      style={tx.type === 'savings' ? { color: 'var(--color-savings)' } : undefined}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'savings' ? '=' : '-'}{formatAmount(tx.amount)}
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditTx(tx)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTx(tx)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <TransactionForm onSuccess={() => { setAddOpen(false); refetch() }} onCancel={() => setAddOpen(false)} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        {editTx && (
          <TransactionForm
            transaction={editTx}
            onSuccess={() => { setEditTx(null); refetch() }}
            onCancel={() => setEditTx(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Delete Transaction">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteTx(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
