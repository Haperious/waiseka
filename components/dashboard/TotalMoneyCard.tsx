'use client'

import CompactHealthRing from './CompactHealthRing'
import type { Account } from '@/hooks/useAccounts'
import { useCurrency } from '@/context/CurrencyContext'

interface TotalMoneyCardProps {
  /** Total per currency - never summed across currencies (no FX conversion). */
  moneyByCurrency: Map<string, number>
  accountCount: number
  healthScore: number
  healthStatusLabel: string
  accounts: Account[]
}

export default function TotalMoneyCard({
  moneyByCurrency, accountCount, healthScore, healthStatusLabel, accounts,
}: TotalMoneyCardProps) {
  const { currency: primary, formatAmountIn } = useCurrency()
  const strip = accounts.slice(0, 4)
  // One line per currency, primary first. No accounts yet → a single zero in the primary currency.
  const totals: [string, number][] = moneyByCurrency.size === 0
    ? [[primary, 0]]
    : [...moneyByCurrency].sort(([a], [b]) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)))
  const isMulti = totals.length > 1

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em',
            fontWeight: 600, color: 'var(--color-text-muted)',
          }}>
            Total Money
          </p>
          {totals.map(([code, total]) => (
            <p key={code} style={{
              fontSize: isMulti ? '1.9rem' : '2.6rem', fontWeight: 800, lineHeight: 1,
              letterSpacing: '-0.02em', color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatAmountIn(total, code)}
            </p>
          ))}
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {accountCount} account{accountCount === 1 ? '' : 's'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <CompactHealthRing score={healthScore} />
          <span style={{
            fontSize: '0.62rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999,
            backgroundColor: healthScore >= 70 ? 'var(--color-income-bg)' : healthScore >= 45 ? 'var(--color-warning-bg)' : 'var(--color-expense-bg)',
            color: healthScore >= 70 ? 'var(--color-income)' : healthScore >= 45 ? 'var(--color-warning)' : 'var(--color-expense)',
          }}>
            {healthStatusLabel}
          </span>
        </div>
      </div>

      {strip.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${strip.length}, 1fr)`, gap: 8 }} className="max-sm:!grid-cols-1">
          {strip.map((account) => {
            const isCredit = account.type === 'credit'
            const amount = isCredit ? -(account.outstandingBalance ?? 0) : (account.computedBalance ?? 0)
            return (
              <div
                key={account._id}
                style={{
                  borderRadius: 12,
                  backgroundColor: 'var(--color-elevated)',
                  borderLeft: `3px solid ${isCredit ? 'var(--color-warning)' : 'var(--color-accent)'}`,
                  padding: '9px 11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <span style={{
                  fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {account.name}
                </span>
                <span style={{
                  fontSize: '0.82rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: amount < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)',
                }}>
                  {formatAmountIn(amount, account.currency)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
