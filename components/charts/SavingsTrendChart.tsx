'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useCurrency } from '@/context/CurrencyContext'
import { useTheme } from '@/context/ThemeContext'
import { formatAmountShort } from '@/lib/currency'

interface DataPoint {
  month: string
  savings: number
}

export default function SavingsTrendChart({ data }: { data: DataPoint[] }) {
  const { currency, formatAmount } = useCurrency()
  const { theme } = useTheme()

  const savingsColor = theme === 'dark' ? '#56C97F' : '#1A6B3A'

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v) => formatAmountShort(v, currency)}
          tick={{ fontSize: 11 }}
          width={70}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [formatAmount(Number(value)), 'Savings']}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        <Line
          type="monotone"
          dataKey="savings"
          stroke={savingsColor}
          strokeWidth={2.5}
          dot={{ fill: savingsColor, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
