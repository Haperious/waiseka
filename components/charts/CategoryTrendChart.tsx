'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatAmountShort } from '@/lib/currency'
import { useCurrency } from '@/context/CurrencyContext'

export interface CategoryTrendData {
  name: string
  color: string
  data: number[]
}

interface CategoryTrendChartProps {
  months: string[]
  categories: CategoryTrendData[]
}

// Flatten the column-oriented API data into the row-oriented shape Recharts expects
function buildChartData(months: string[], categories: CategoryTrendData[]) {
  return months.map((month, i) => {
    const row: Record<string, string | number> = { month }
    for (const cat of categories) {
      row[cat.name] = cat.data[i] ?? 0
    }
    return row
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      maxWidth: 180,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <p key={entry.name} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: {entry.value > 0 ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
        </p>
      ))}
    </div>
  )
}

export default function CategoryTrendChart({ months, categories }: CategoryTrendChartProps) {
  const { currency } = useCurrency()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const chartHeight = isMobile ? 220 : 280
  const xAxisInterval = isMobile ? 1 : 0
  const chartData = buildChartData(months, categories)

  return (
    <div>
      {/* Custom chip-row legend - no Recharts Legend component */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
        overflowX: 'auto',
      }}>
        {categories.map((cat) => (
          <div key={cat.name} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: 'var(--color-elevated)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: cat.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              {cat.name}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            interval={xAxisInterval}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={60}
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v) => formatAmountShort(v, currency)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {categories.map((cat) => (
            <Line
              key={cat.name}
              type="linear"
              dataKey={cat.name}
              stroke={cat.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
