'use client'

import { format } from 'date-fns'
import {
  TrendingUp, TrendingDown, PiggyBank, Pencil, Trash2, RefreshCw, ArrowLeftRight,
} from 'lucide-react'
import { SkeletonRow } from '@/components/ui/Skeleton'
import type { Transaction } from '@/hooks/useTransactions'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'

interface TransactionListProps {
  transactions: Transaction[]
  loading: boolean
  accountNameById: Map<string, string>
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

// ── Shared type -> icon/color config (type badge + mobile row tiles) ───────
function useTypeVisual() {
  const { t } = useLanguage()
  return (type: string) =>
    type === 'income'
      ? { color: 'var(--color-income)', bg: 'var(--color-income-bg)', Icon: TrendingUp, label: t('common.income') }
      : type === 'savings'
      ? { color: 'var(--color-savings)', bg: 'var(--color-savings-bg)', Icon: PiggyBank, label: t('common.savings') }
      : type === 'transfer'
      ? { color: 'var(--color-accent)', bg: 'var(--color-sage)', Icon: ArrowLeftRight, label: t('common.transfer') }
      : { color: 'var(--color-expense)', bg: 'var(--color-expense-bg)', Icon: TrendingDown, label: t('common.expense') }
}

function transferLabel(tx: Transaction, accountNameById: Map<string, string>): string {
  const from = (tx.fromAccountId ? accountNameById.get(tx.fromAccountId) : null) ?? '?'
  const to = (tx.toAccountId ? accountNameById.get(tx.toAccountId) : null) ?? '?'
  return `${from} → ${to}`
}

// ── Type badge ────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const config = useTypeVisual()(type)

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '0.68rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: 999,
      backgroundColor: config.bg,
      color: config.color,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
    }}>
      <config.Icon style={{ width: 10, height: 10 }} />
      {config.label}
    </span>
  )
}

// ── Amount display ────────────────────────────────────────────────────────
function AmountCell({ tx }: { tx: Transaction }) {
  const { formatAmountIn } = useCurrency()
  const color =
    tx.type === 'income' ? 'var(--color-income)' :
    tx.type === 'savings' ? 'var(--color-savings)' :
    tx.type === 'transfer' ? 'var(--color-accent)' :
    'var(--color-expense)'
  const prefix = tx.type === 'income' ? '+' : tx.type === 'savings' ? '=' : tx.type === 'transfer' ? '⇄' : '−'

  return (
    <span style={{
      color,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      fontSize: '0.9rem',
      whiteSpace: 'nowrap',
    }}>
      {prefix}{formatAmountIn(tx.amount, tx.currency)}
    </span>
  )
}

// ── Day-grouped rows (mobile) ────────────────────────────────────────────
// Net total per day counts income/expense only - savings and transfers move
// money sideways rather than in or out, so they're shown but excluded from the total.
// Nets are kept per currency (never summed across currencies); '' = no currency,
// which counts as the primary currency.
function groupByDay(txs: Transaction[]) {
  const groups: { dateKey: string; date: Date; items: Transaction[]; netByCurrency: Map<string, number> }[] = []
  for (const tx of txs) {
    const dateKey = format(new Date(tx.date), 'yyyy-MM-dd')
    let group = groups[groups.length - 1]?.dateKey === dateKey ? groups[groups.length - 1] : undefined
    if (!group) {
      group = { dateKey, date: new Date(tx.date), items: [], netByCurrency: new Map() }
      groups.push(group)
    }
    group.items.push(tx)
    const delta = tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0
    if (delta !== 0) {
      const key = tx.currency ?? ''
      group.netByCurrency.set(key, (group.netByCurrency.get(key) ?? 0) + delta)
    }
  }
  return groups
}

/** Folds the no-currency bucket into the primary currency, primary first. */
function mergeNoCurrency(netByCurrency: Map<string, number>, primary: string): [string, number][] {
  // A day with only savings/transfers still shows a zero net, as before
  const merged = new Map<string, number>(netByCurrency.size === 0 ? [[primary, 0]] : [])
  for (const [code, net] of netByCurrency) {
    const key = code || primary
    merged.set(key, (merged.get(key) ?? 0) + net)
  }
  return [...merged].sort(([a], [b]) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)))
}

function MobileTransactionRow({ tx, accountNameById, onEdit, onDelete }: {
  tx: Transaction
  accountNameById: Map<string, string>
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  const { t } = useLanguage()
  const { Icon, color, bg } = useTypeVisual()(tx.type)
  const accountLabel = tx.type === 'transfer'
    ? transferLabel(tx, accountNameById)
    : tx.accountId ? (accountNameById.get(tx.accountId) ?? t('tx.unknownAccount')) : t('quickAdd.unassigned')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        backgroundColor: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 16, height: 16 }} />
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
          {tx.category} · {accountLabel}
          {tx.isRecurring && ' · ↻'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <AmountCell tx={tx} />
        {tx.type !== 'transfer' && (
          <button
            onClick={() => onEdit(tx)}
            aria-label={t('common.edit')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8, marginLeft: 4,
              border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-muted)',
            }}
          >
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
        )}
        <button
          onClick={() => onDelete(tx)}
          aria-label={t('common.delete')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 8,
            border: 'none', backgroundColor: 'transparent', color: 'var(--color-text-muted)',
          }}
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  )
}

/** Day-grouped list for phone/tablet widths (no table/columns). */
export function MobileTransactionList({ transactions, loading, accountNameById, onEdit, onDelete }: TransactionListProps) {
  const { t } = useLanguage()
  const { currency: primary, formatAmountIn } = useCurrency()

  if (loading) return <>{[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}</>

  if (transactions.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
        {t('tx.noResults')}
      </div>
    )
  }

  return (
    <>
      {groupByDay(transactions).map((group, gi) => (
        <div key={group.dateKey} style={{ paddingTop: gi === 0 ? 8 : 16 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '4px 4px 6px', borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {format(group.date, 'EEE, MMM d')}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              {mergeNoCurrency(group.netByCurrency, primary).map(([code, net]) => (
                <span key={code} style={{
                  fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                }}>
                  {net >= 0 ? '+' : '−'}{formatAmountIn(Math.abs(net), code)}
                </span>
              ))}
            </span>
          </div>
          {group.items.map((tx, i) => (
            <div key={tx._id} style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <MobileTransactionRow tx={tx} accountNameById={accountNameById} onEdit={onEdit} onDelete={onDelete} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

const rowActionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8,
  border: 'none', backgroundColor: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  transition: 'all 0.12s',
}

/** Full table for desktop widths. */
export function TransactionTable({ transactions, loading, accountNameById, onEdit, onDelete }: TransactionListProps) {
  const { t } = useLanguage()

  const columns = [
    { label: t('common.date'),        className: '' },
    { label: t('common.description'), className: '' },
    { label: t('tx.recurring'),       className: 'hidden sm:table-cell' },
    { label: t('common.category'),    className: 'hidden sm:table-cell' },
    { label: t('quickAdd.account'),   className: 'hidden md:table-cell' },
    { label: t('common.type'),        className: 'hidden md:table-cell' },
    { label: t('common.amount'),      className: '', align: 'right' as const },
    { label: '',                      className: '' },
  ]

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          {columns.map(({ label, className, align }, i) => (
            <th
              key={i}
              className={className}
              style={{
                padding: '10px 20px',
                textAlign: align ?? 'left',
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {loading ? (
          [...Array(8)].map((_, i) => (
            <tr key={i}>
              <td colSpan={columns.length} style={{ padding: '0 20px' }}>
                <SkeletonRow />
              </td>
            </tr>
          ))
        ) : transactions.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: '0.88rem',
              }}>
                {t('tx.noResults')}
              </div>
            </td>
          </tr>
        ) : (
          transactions.map((tx, idx) => (
            <tr
              key={tx._id}
              style={{
                borderBottom: idx < transactions.length - 1 ? '1px solid var(--color-border)' : 'none',
                transition: 'background-color 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--color-elevated)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'
              }}
            >
              {/* Date */}
              <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {format(new Date(tx.date), 'MMM d')}
                </span>
                <span className="hidden sm:inline" style={{ color: 'var(--color-text-muted)', marginLeft: 2 }}>
                  , {format(new Date(tx.date), 'yyyy')}
                </span>
              </td>

              {/* Description */}
              <td style={{
                padding: '12px 20px',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tx.description || '-'}
              </td>

              {/* Recurring */}
              <td className="hidden sm:table-cell" style={{ padding: '12px 20px' }}>
                {tx.isRecurring && (
                  <span
                    title={t('tx.recurring')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: '0.65rem', fontWeight: 700,
                      padding: '2px 7px', borderRadius: 999,
                      backgroundColor: 'var(--color-sage)',
                      color: 'var(--color-accent)',
                      border: '1px solid var(--color-accent)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <RefreshCw style={{ width: 9, height: 9 }} />
                    {t('tx.recurring')}
                  </span>
                )}
              </td>

              {/* Category */}
              <td className="hidden sm:table-cell" style={{ padding: '12px 20px', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                {tx.category}
              </td>

              {/* Account */}
              <td className="hidden md:table-cell" style={{ padding: '12px 20px', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                {tx.type === 'transfer' ? (
                  <span style={{ whiteSpace: 'nowrap' }}>{transferLabel(tx, accountNameById)}</span>
                ) : tx.accountId ? (accountNameById.get(tx.accountId) ?? t('tx.unknownAccount')) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>{t('common.unassigned')}</span>
                )}
              </td>

              {/* Type badge */}
              <td className="hidden md:table-cell" style={{ padding: '12px 20px' }}>
                <TypeBadge type={tx.type} />
              </td>

              {/* Amount */}
              <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                <AmountCell tx={tx} />
              </td>

              {/* Actions */}
              <td style={{ padding: '12px 16px 12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {/* Transfers are not editable via the standard form - delete and re-create instead */}
                  {tx.type !== 'transfer' && (
                    <button
                      onClick={() => onEdit(tx)}
                      aria-label={t('common.edit')}
                      style={rowActionStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-sage)'
                        e.currentTarget.style.color = 'var(--color-accent)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-muted)'
                      }}
                    >
                      <Pencil style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(tx)}
                    aria-label={t('common.delete')}
                    style={rowActionStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'
                      e.currentTarget.style.color = 'var(--color-expense)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--color-text-muted)'
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
