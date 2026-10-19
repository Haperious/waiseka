'use client'

import { useState } from 'react'
import { PieChart, Pie, Tooltip, ResponsiveContainer, Sector } from 'recharts'
import type { PieSectorShapeProps } from 'recharts/types/polar/Pie'
import { useCurrency } from '@/context/CurrencyContext'

interface CategoryData {
  category: string
  total: number
  percentage: number
}

const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#166534', '#16a34a', '#d97706', '#b45309', '#2563eb', '#7c3aed', '#6366f1', '#10b981',
]

export default function CategoryPieChart({ data }: { data: CategoryData[] }) {
  const { formatAmount } = useCurrency()
  // null = nothing pinned (hover-only mode); number = pinned index
  const [pinned, setPinned] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        No expense data
      </div>
    )
  }

  // Which slice is "active" - pinned takes priority, then hover
  const activeIndex = pinned ?? hovered ?? undefined

  const handleLegendClick = (i: number) => {
    setPinned((prev) => (prev === i ? null : i))
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={52}
            paddingAngle={2}
            onMouseEnter={(_, i) => { if (pinned === null) setHovered(i) }}
            onMouseLeave={() => { if (pinned === null) setHovered(null) }}
            onClick={(_, i) => {
              setPinned((prev) => (prev === i ? null : i))
            }}
            style={{ cursor: 'pointer' }}
            shape={(props: PieSectorShapeProps) => {
              const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, index } = props
              const fill = COLORS[index % COLORS.length]
              const isActive = activeIndex === index
              return (
                <Sector
                  cx={cx}
                  cy={cy}
                  innerRadius={isActive ? innerRadius - 2 : innerRadius}
                  outerRadius={isActive ? outerRadius + 10 : outerRadius}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  fill={fill}
                  opacity={activeIndex === undefined || isActive ? 1 : 0.3}
                  style={{ transition: 'opacity 0.2s' }}
                />
              )
            }}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [formatAmount(Number(value)), 'Amount']}
            contentStyle={{
              borderRadius: 8,
              fontSize: 13,
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend - click to pin/highlight */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 10px',
        marginTop: 8,
        padding: '0 4px',
      }}>
        {data.map((item, i) => {
          const color = COLORS[i % COLORS.length]
          const isActive = activeIndex === i
          const isDimmed = activeIndex !== undefined && !isActive

          return (
            <button
              key={item.category}
              onClick={() => handleLegendClick(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 999,
                border: isActive
                  ? `1px solid ${color}`
                  : '1px solid var(--color-border)',
                backgroundColor: isActive
                  ? `${color}18`
                  : 'var(--color-elevated)',
                opacity: isDimmed ? 0.45 : 1,
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              title={`${item.category} - ${formatAmount(item.total)} (${item.percentage}%)`}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: color, flexShrink: 0,
              }} />
              <span style={{
                fontSize: '0.7rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? color : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}>
                {item.category}
              </span>
              <span style={{
                fontSize: '0.65rem',
                color: isActive ? color : 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {item.percentage}%
              </span>
            </button>
          )
        })}
        {pinned !== null && (
          <button
            onClick={() => setPinned(null)}
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
