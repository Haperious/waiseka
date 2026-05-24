'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useCurrency } from '@/context/CurrencyContext'
import { useBudgets } from '@/hooks/useBudgets'
import { useTransactions, Transaction } from '@/hooks/useTransactions'
import TransactionForm from '../transactions/TransactionForm'
import dynamic from 'next/dynamic'

const MonthlyTrendChart = dynamic(() => import('@/components/charts/MonthlyTrendChart'), { ssr: false })

interface Summary {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: { category: string; total: number; percentage: number }[]
}

interface MonthlyData {
  month: string
  income: number
  expenses: number
}

export default function DashboardPage() {
  const { formatAmount } = useCurrency()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [addTxOpen, setAddTxOpen] = useState(false)

  const { budgets } = useBudgets()
  const { transactions, loading: txLoading, refetch } = useTransactions({ limit: 7 })

  const now = new Date()

  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/summary?month=${currentMonth}&year=${currentYear}`)
      const data = await res.json()
      setSummary(data)
    } catch {
      /* ignore */
    } finally {
      setLoadingSummary(false)
    }
  }, [currentMonth, currentYear])

  const loadTrend = useCallback(async () => {
    const results: MonthlyData[] = []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIndex = now.getMonth()
    for (let m = Math.max(0, monthIndex - 5); m <= monthIndex; m++) {
      try {
        const res = await fetch(`/api/summary?month=${m + 1}&year=${currentYear}`)
        const d = await res.json()
        results.push({ month: months[m], income: d.totalIncome, expenses: d.totalExpenses })
      } catch {
        results.push({ month: months[m], income: 0, expenses: 0 })
      }
    }
    setMonthlyData(results)
  }, [currentYear])

  useEffect(() => {
    loadSummary()
    loadTrend()
  }, [loadSummary, loadTrend])

  const summaryCards = [
    { label: 'Total Income', value: summary?.totalIncome, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Total Expenses', value: summary?.totalExpenses, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Net Savings', value: summary?.netSavings, icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Savings Rate', value: summary?.savingsRate, icon: DollarSign, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', isPercent: true },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {format(now, 'MMMM yyyy')} overview
          </p>
        </div>
        <Button onClick={() => setAddTxOpen(true)} size="sm">
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Transaction</span>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color, bg, isPercent }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                {loadingSummary ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : (
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                    {isPercent ? `${value ?? 0}%` : formatAmount(value ?? 0)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Income vs Expenses</h2>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <MonthlyTrendChart data={monthlyData} />
            )}
          </CardContent>
        </Card>

        {/* Budget overview */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Budget Overview</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No budgets yet</p>
            ) : (
              budgets.slice(0, 5).map((b) => (
                <div key={b._id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{b.category}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {formatAmount(b.spent)} / {formatAmount(b.limit)}
                    </span>
                  </div>
                  <ProgressBar value={b.spent} max={b.limit} showLabel />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
          <a href="/transactions" className="text-sm text-blue-600 hover:underline">View all</a>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 dark:divide-gray-700 p-0">
          {txLoading ? (
            <div className="px-6 space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 px-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 px-6">No transactions yet</p>
          ) : (
            transactions.map((tx: Transaction) => (
              <div key={tx._id} className="flex items-center gap-4 px-6 py-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'income'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  }`}
                >
                  {tx.type === 'income' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {tx.description || tx.category}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tx.category} · {format(new Date(tx.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'}
                  {formatAmount(tx.amount)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Modal open={addTxOpen} onClose={() => setAddTxOpen(false)} title="Add Transaction">
        <TransactionForm
          onSuccess={() => {
            setAddTxOpen(false)
            refetch()
            loadSummary()
          }}
          onCancel={() => setAddTxOpen(false)}
        />
      </Modal>
    </div>
  )
}
