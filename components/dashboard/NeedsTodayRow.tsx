'use client'

import Link from 'next/link'
import { TrendingDown, CreditCard, PiggyBank } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export interface InsightItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  icon: 'TrendingDown' | 'CreditCard' | 'PiggyBank'
  title: string
  body: string
  href: string
}

const ICONS: Record<InsightItem['icon'], LucideIcon> = {
  TrendingDown,
  CreditCard,
  PiggyBank,
}

const SEVERITY_COLOR: Record<InsightItem['severity'], string> = {
  critical: 'var(--color-expense)',
  warning: 'var(--color-warning)',
  info: 'var(--color-accent)',
}
const SEVERITY_BG: Record<InsightItem['severity'], string> = {
  critical: 'var(--color-expense-bg)',
  warning: 'var(--color-warning-bg)',
  info: 'var(--color-sage)',
}

export default function NeedsTodayRow({ items, loading }: { items: InsightItem[]; loading: boolean }) {
  if (!loading && items.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{
        fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em',
        fontWeight: 600, color: 'var(--color-text-muted)',
      }}>
        Needs you today
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : items.slice(0, 3).map((item) => {
              const Icon = ICONS[item.icon]
              const color = SEVERITY_COLOR[item.severity]
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    backgroundColor: SEVERITY_BG[item.severity],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon style={{ width: 15, height: 15, color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                      {item.body}
                    </p>
                  </div>
                </Link>
              )
            })}
      </div>
    </div>
  )
}
