'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useCurrency } from '@/context/CurrencyContext'
import { formatAmountShort } from '@/lib/currency'

interface DataPoint {
  month: string
  income: number
  expenses: number
}

export default function IncomeExpenseChart({ data }: { data: DataPoint[] }) {
  const { currency, formatAmount } = useCurrency()

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => formatAmountShort(v, currency)} tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [formatAmount(Number(value)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
        <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
      </BarChart>
    </ResponsiveContainer>
  )
}
