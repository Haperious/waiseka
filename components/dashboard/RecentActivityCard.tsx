'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'

const TYPE_ICON: Record<string, LucideIcon> = {
  income: TrendingUp,
  expense: TrendingDown,
  savings: PiggyBank,
  transfer: ArrowLeftRight,
}
const TYPE_COLOR: Record<string, string> = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  savings: 'var(--color-savings)',
  transfer: 'var(--color-accent)',
}
const TYPE_BG: Record<string, string> = {
  income: 'var(--color-income-bg)',
  expense: 'var(--color-expense-bg)',
  savings: 'var(--color-savings-bg)',
  transfer: 'var(--color-sage)',
}

export default function RecentActivityCard({
  formatAmount,
}: {
  formatAmount: (v: number) => string
}) {
  const { transactions, total, loading } = useTransactions({ limit: 4 })
  const { accounts } = useAccounts()

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a._id, a.name]))
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  }, [accounts])

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Recent activity</p>
        <Link href="/transactions" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
          All {total} →
        </Link>
      </div>

      <div style={{ padding: '10px 20px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full my-1" />)}</>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No transactions yet.
          </p>
        ) : (
          transactions.map((tx, i) => {
            const Icon = TYPE_ICON[tx.type] ?? ArrowLeftRight
            const color = TYPE_COLOR[tx.type] ?? 'var(--color-text-primary)'
            const acct = accountName(tx.accountId)
            const subtitleParts = [tx.category, acct, tx.isRecurring ? 'recurring' : null].filter(Boolean)
            const sign = tx.type === 'expense' ? '-' : tx.type === 'transfer' ? '' : '+'
            return (
              <div key={tx._id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  backgroundColor: TYPE_BG[tx.type] ?? 'var(--color-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: 15, height: 15, color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tx.description || tx.category}
                  </p>
                  <p style={{
                    fontSize: '0.72rem', color: 'var(--color-text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {subtitleParts.join(' · ')}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.85rem', fontWeight: 700, color, flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}>
                  {sign}{formatAmount(Math.abs(tx.amount))}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
