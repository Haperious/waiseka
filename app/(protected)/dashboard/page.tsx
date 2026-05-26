'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import ProgressBar from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useCurrency } from '@/context/CurrencyContext'
import type { Budget } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionForm from '../transactions/TransactionForm'
import dynamic from 'next/dynamic'

const IncomeExpenseChart = dynamic(() => import('@/components/charts/IncomeExpenseChart'), { ssr: false })

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Summary {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: { category: string; total: number; percentage: number }[]
}

export default function DashboardPage() {
  const { formatAmount } = useCurrency()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [addTxOpen, setAddTxOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth))
  const [allMonths, setAllMonths] = useState<{ month: string; income: number; expenses: number; savings: number }[]>([])
  const [analyticsSummary, setAnalyticsSummary] = useState<Summary | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [yearlyLoading, setYearlyLoading] = useState(true)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetsLoading, setBudgetsLoading] = useState(true)

  const { refetch } = useTransactions({ limit: 1 })

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i
    return { value: String(y), label: String(y) }
  })

  const loadYearlyTrend = useCallback(async () => {
    setYearlyLoading(true)
    const year = parseInt(selectedYear)
    const results = []
    for (let m = 1; m <= 12; m++) {
      try {
        const res = await fetch(`/api/summary?month=${m}&year=${year}`)
        const d = await res.json()
        results.push({ month: MONTH_LABELS[m - 1], income: d.totalIncome, expenses: d.totalExpenses, savings: d.totalSavings ?? 0 })
      } catch {
        results.push({ month: MONTH_LABELS[m - 1], income: 0, expenses: 0, savings: 0 })
      }
    }
    setAllMonths(results)
    setYearlyLoading(false)
  }, [selectedYear])

  const loadAnalyticsSummary = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/summary?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setAnalyticsSummary(data)
    } catch {
      /* ignore */
    } finally {
      setAnalyticsLoading(false)
    }
  }, [selectedMonth, selectedYear])

  const loadBudgets = useCallback(async () => {
    setBudgetsLoading(true)
    try {
      const res = await fetch(`/api/budgets?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setBudgets(Array.isArray(data) ? data : [])
    } catch {
      /* ignore */
    } finally {
      setBudgetsLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => { loadYearlyTrend() }, [loadYearlyTrend])
  useEffect(() => { loadAnalyticsSummary() }, [loadAnalyticsSummary])
  useEffect(() => { loadBudgets() }, [loadBudgets])

  const summaryCards = [
    { label: 'Total Income', value: analyticsSummary?.totalIncome, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Total Expenses', value: analyticsSummary?.totalExpenses, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Total Savings', value: analyticsSummary?.totalSavings, icon: PiggyBank, color: '', bg: '', isSavings: true },
    { label: 'Savings Rate', value: analyticsSummary?.savingsRate, icon: DollarSign, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', isPercent: true },
  ]

  const topCategory = analyticsSummary?.categoryBreakdown?.[0]

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

      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Spending Breakdown</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial insights and trends</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:w-36">
              <Select value={selectedMonth} onValueChange={setSelectedMonth} options={MONTHS} />
            </div>
            <div className="flex-1 sm:w-28">
              <Select value={selectedYear} onValueChange={setSelectedYear} options={years} />
            </div>
          </div>
        </div>

        {!analyticsLoading && analyticsSummary && topCategory && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            💡 You spent <strong>{topCategory.percentage}%</strong> on <strong>{topCategory.category}</strong> this period
            {analyticsSummary.savingsRate > 0 && <>, saving <strong>{analyticsSummary.savingsRate}%</strong> of your income</>}.
          </div>
        )}

        {/* Summary cards - driven by selected month/year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map(({ label, value, icon: Icon, color, bg, isPercent, isSavings }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 py-5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${!isSavings ? bg : ''}`}
                  style={isSavings ? { backgroundColor: 'var(--color-savings-bg)' } : undefined}
                >
                  <Icon
                    className={`h-6 w-6 ${!isSavings ? color : ''}`}
                    style={isSavings ? { color: 'var(--color-savings)' } : undefined}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                  {analyticsLoading ? (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income vs Expenses (yearly) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">Income vs Expenses - {selectedYear}</h2>
            </CardHeader>
            <CardContent>
              {yearlyLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : allMonths.every((d) => d.income === 0 && d.expenses === 0 && d.savings === 0) ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                  No transaction data for {selectedYear}
                </div>
              ) : (
                <IncomeExpenseChart data={allMonths} />
              )}
            </CardContent>
          </Card>

          {/* Budget overview */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">Budget Overview</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgetsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : budgets.length === 0 ? (
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

        {/* Category breakdown table */}
        {!analyticsLoading && analyticsSummary && analyticsSummary.categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900 dark:text-white">Category Breakdown</h2>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">%</th>
                    <th className="px-3 sm:px-6 py-3 w-1/4 hidden sm:table-cell">
                      <span className="sr-only">Bar</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {analyticsSummary.categoryBreakdown.map((c, i) => (
                    <tr key={c.category} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 sm:px-6 py-3 font-medium text-gray-900 dark:text-white text-xs sm:text-sm">{c.category}</td>
                      <td className="px-3 sm:px-6 py-3 text-right text-gray-700 dark:text-gray-300 text-xs sm:text-sm">{formatAmount(c.total)}</td>
                      <td className="px-3 sm:px-6 py-3 text-right text-gray-700 dark:text-gray-300 text-xs sm:text-sm">{c.percentage}%</td>
                      <td className="px-3 sm:px-6 py-3 hidden sm:table-cell">
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${c.percentage}%`, backgroundColor: ['#3b82f6','#22c55e','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'][i % 8] }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={addTxOpen} onClose={() => setAddTxOpen(false)} title="Add Transaction">
        <TransactionForm
          onSuccess={() => {
            setAddTxOpen(false)
            refetch()
            loadAnalyticsSummary()
            loadBudgets()
          }}
          onCancel={() => setAddTxOpen(false)}
        />
      </Modal>
    </div>
  )
}
