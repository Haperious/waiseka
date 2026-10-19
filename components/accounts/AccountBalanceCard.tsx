'use client'

import { AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatAmount } from '@/lib/currency'
import type { Account } from '@/hooks/useAccounts'

interface AccountBalanceCardProps {
  account: Account
  active: boolean
  onClick: () => void
  /** True during initial load and post-mutation refetch (see AccountStrip). */
  balanceLoading?: boolean
}

export default function AccountBalanceCard({ account, active, onClick, balanceLoading }: AccountBalanceCardProps) {
  const isCredit = account.type === 'credit'
  const fmt = (v: number) => formatAmount(v, account.currency)

  // Derived on read from transactions (see lib/services/accountBalance.ts) - never computed here.
  const displayBalance = isCredit
    ? (account.outstandingBalance ?? 0)
    : (account.computedBalance ?? account.openingBalance)

  const isLowBalance =
    !isCredit && account.lowBalanceThreshold != null && displayBalance < account.lowBalanceThreshold

  const showAvailableCredit = isCredit && account.creditLimit != null && account.availableCredit != null

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 150,
        maxWidth: 150,
        flexShrink: 0,
        textAlign: 'left',
        borderRadius: 12,
        padding: '10px 12px',
        cursor: 'pointer',
        backgroundColor: active ? 'var(--color-sage)' : 'var(--color-card)',
        border: `1px solid ${active ? 'var(--color-accent)' : isLowBalance ? 'var(--color-warning)' : 'var(--color-border)'}`,
        borderLeftWidth: 3,
        borderLeftColor: isCredit ? 'var(--color-warning)' : 'var(--color-accent)',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {account.name}
      </span>

      {balanceLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLowBalance && <AlertTriangle style={{ width: 12, height: 12, color: 'var(--color-warning)', flexShrink: 0 }} />}
          <span
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: isCredit
                ? (displayBalance > 0 ? 'var(--color-expense)' : 'var(--color-text-primary)')
                : displayBalance < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fmt(displayBalance)}
          </span>
        </div>
      )}

      {showAvailableCredit && !balanceLoading && (
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Available: {fmt(account.availableCredit as number)}
        </span>
      )}
    </button>
  )
}
