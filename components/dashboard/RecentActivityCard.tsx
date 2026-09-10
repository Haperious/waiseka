'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useVoiceKeywords } from '@/hooks/useVoiceKeywords'
import { parseSpeechToTransaction } from '@/lib/parseSpeechToTransaction'
import { emitTransactionSaved } from '@/lib/transactionEvents'
import { useToast } from '@/components/ui/Toast'

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
  const { transactions, total, loading, refetch } = useTransactions({ limit: 4 })
  const { accounts } = useAccounts()
  const { keywords } = useVoiceKeywords()
  const { toast } = useToast()

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a._id, a.name]))
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  }, [accounts])

  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (query.trim() ? parseSpeechToTransaction(query, keywords) : null), [query, keywords])
  const matchedAccount = useMemo(() => {
    if (!query.trim()) return null
    const lower = query.toLowerCase()
    return accounts.find((a) => lower.includes(a.name.toLowerCase())) ?? null
  }, [query, accounts])

  const handleSubmit = async () => {
    if (!parsed?.amount || !parsed?.type || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsed.amount,
          type: parsed.type,
          category: parsed.category ?? 'Other',
          description: parsed.description,
          date: new Date().toISOString(),
          accountId: matchedAccount?._id ?? null,
        }),
      })
      if (!res.ok) throw new Error('Failed to add transaction')
      emitTransactionSaved()
      setQuery('')
      refetch()
      toast('Transaction added')
    } catch {
      toast('Could not add transaction', 'error')
    } finally {
      setSaving(false)
      inputRef.current?.focus()
    }
  }

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

      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full my-1" />)}</>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No transactions yet.
          </p>
        ) : (
          transactions.map((tx) => {
            const Icon = TYPE_ICON[tx.type] ?? ArrowLeftRight
            const color = TYPE_COLOR[tx.type] ?? 'var(--color-text-primary)'
            const acct = accountName(tx.accountId)
            const subtitleParts = [tx.category, acct, tx.isRecurring ? 'recurring' : null].filter(Boolean)
            const sign = tx.type === 'expense' ? '-' : tx.type === 'transfer' ? '' : '+'
            return (
              <div key={tx._id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--color-border)',
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

      <div style={{ padding: '10px 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 10, border: '1px dashed var(--color-border)',
          padding: '8px 12px',
        }}>
          <Plus style={{ width: 14, height: 14, color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Type here to log something — amount, category, account"
            disabled={saving}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '0.82rem', color: 'var(--color-text-primary)', minWidth: 0,
            }}
          />
        </div>
      </div>
    </div>
  )
}
