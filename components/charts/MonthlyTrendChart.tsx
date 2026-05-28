'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useCurrency } from '@/context/CurrencyContext'
import { useTheme } from '@/context/ThemeContext'
import { formatAmountShort } from '@/lib/currency'

interface DataPoint {
  month: string
  income: number
  expenses: number
  savings?: number
}

interface MonthlyTrendChartProps {
  data: DataPoint[]
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const { currency } = useCurrency()
  const { theme } = useTheme()

  const incomeColor  = theme === 'dark' ? '#4ADE80' : '#166534'
  const expenseColor = theme === 'dark' ? '#F87171' : '#B91C1C'
  const savingsColor = theme === 'dark' ? '#34D399' : '#16A34A'

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-gray-500" />
        <YAxis
          tickFormatter={(v) => formatAmountShort(v, currency)}
          tick={{ fontSize: 11 }}
          className="fill-gray-500"
          width={70}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${currency} ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        <Legend />
        <Bar dataKey="income" fill={incomeColor} radius={[4, 4, 0, 0]} name="Income" />
        <Bar dataKey="expenses" fill={expenseColor} radius={[4, 4, 0, 0]} name="Expenses" />
        <Bar dataKey="savings" fill={savingsColor} radius={[4, 4, 0, 0]} name="Savings" />
      </BarChart>
    </ResponsiveContainer>
  )
}
