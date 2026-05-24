'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCurrency } from '@/context/CurrencyContext'
import dynamic from 'next/dynamic'

const IncomeExpenseChart = dynamic(() => import('@/components/charts/IncomeExpenseChart'), { ssr: false })
const CategoryPieChart = dynamic(() => import('@/components/charts/CategoryPieChart'), { ssr: false })
const SavingsTrendChart = dynamic(() => import('@/components/charts/SavingsTrendChart'), { ssr: false })

interface MonthlySummary {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: { category: string; total: number; percentage: number }[]
}

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ReportsPage() {
  const now = new Date()
  const { formatAmount } = useCurrency()
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [allMonths, setAllMonths] = useState<{ month: string; income: number; expenses: number; savings: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1))

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - i
    return { value: String(y), label: String(y) }
  })

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/summary?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setSummary(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  const loadYearlyTrend = useCallback(async () => {
    const year = parseInt(selectedYear)
    const results = []
    for (let m = 1; m <= 12; m++) {
      try {
        const res = await fetch(`/api/summary?month=${m}&year=${year}`)
        const d = await res.json()
        results.push({
          month: MONTH_LABELS[m - 1],
          income: d.totalIncome,
          expenses: d.totalExpenses,
          savings: d.netSavings,
        })
      } catch {
        results.push({ month: MONTH_LABELS[m - 1], income: 0, expenses: 0, savings: 0 })
      }
    }
    setAllMonths(results)
  }, [selectedYear])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadYearlyTrend() }, [loadYearlyTrend])

  const topCategory = summary?.categoryBreakdown?.[0]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial insights and trends</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-36">
            <Select
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              options={MONTHS}
            />
          </div>
          <div className="flex-1 sm:w-28">
            <Select
              value={selectedYear}
              onValueChange={setSelectedYear}
              options={years}
            />
          </div>
        </div>
      </div>

      {/* Text insight */}
      {!loading && summary && topCategory && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          💡 You spent <strong>{topCategory.percentage}%</strong> on <strong>{topCategory.category}</strong> this period
          {summary.savingsRate > 0 && `, saving <strong>${summary.savingsRate}%</strong> of your income`}.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses (yearly) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Income vs Expenses — {selectedYear}</h2>
          </CardHeader>
          <CardContent>
            {allMonths.length === 0 ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <IncomeExpenseChart data={allMonths} />
            )}
          </CardContent>
        </Card>

        {/* Spending by category */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Spending by Category — {MONTHS.find((m) => m.value === selectedMonth)?.label}
            </h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <CategoryPieChart data={summary?.categoryBreakdown ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Savings trend (yearly) */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 dark:text-white">Savings Trend — {selectedYear}</h2>
          </CardHeader>
          <CardContent>
            {allMonths.length === 0 ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <SavingsTrendChart data={allMonths.map((d) => ({ month: d.month, savings: d.savings }))} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown table */}
      {!loading && summary && summary.categoryBreakdown.length > 0 && (
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
                {summary.categoryBreakdown.map((c, i) => (
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
  )
}
