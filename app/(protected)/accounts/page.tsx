'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Pencil, Archive, ArchiveRestore, Lock, Landmark, CreditCard, PiggyBank, Banknote, Smartphone, Wallet, ArrowLeftRight, SlidersHorizontal, Info, ShieldCheck, ShieldAlert, Receipt } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAccounts, Account } from '@/hooks/useAccounts'
import { useLanguage } from '@/context/LanguageContext'
import { TranslationKey } from '@/lib/translations'
import { formatAmount as formatCurrencyAmount } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import AccountForm from './AccountForm'
import TransferForm from './TransferForm'
import AdjustBalanceForm from './AdjustBalanceForm'
import VerifyBalanceForm from './VerifyBalanceForm'

/** Sum a list of accounts' balances grouped by their own currency (no FX conversion). */
function sumByCurrency(items: { currency: string; value: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) map.set(item.currency, (map.get(item.currency) ?? 0) + item.value)
  return map
}

const TYPE_ICON: Record<Account['type'], React.ElementType> = {
  debit: Landmark,
  credit: CreditCard,
  savings: PiggyBank,
  time_deposit: PiggyBank,
  cash: Banknote,
  e_wallet: Smartphone,
}

const TYPE_LABEL_KEY: Record<Account['type'], TranslationKey> = {
  debit: 'account.typeDebit',
  credit: 'account.typeCredit',
  savings: 'account.typeSavings',
  time_deposit: 'account.typeTimeDeposit',
  cash: 'account.typeCash',
  e_wallet: 'account.typeEWallet',
}

function CreditUtilizationBar({ outstanding, limit }: { outstanding: number; limit: number }) {
  const pct = limit > 0 ? Math.min(Math.max((outstanding / limit) * 100, 0), 100) : 0
  const barColor =
    pct >= 90 ? 'var(--color-expense)' :
    pct >= 70 ? 'var(--color-warning)' :
    'var(--color-income)'

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        height: 5, borderRadius: 999,
        backgroundColor: 'var(--color-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          backgroundColor: barColor,
          width: `${pct}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 3, display: 'block' }}>
        {Math.round(pct)}% utilized
      </span>
    </div>
  )
}

/** "Checked 3 days ago" - green while fresh, amber when a check is due or history changed since. */
function VerificationBadge({ account, t, onCheck }: {
  account: Account
  t: (key: TranslationKey) => string
  onCheck: () => void
}) {
  const status = account.verificationStatus ?? 'never'
  const days = account.verifiedDaysAgo ?? 0
  const when = days === 0 ? t('verify.today') : days === 1 ? t('verify.daysAgoOne') : t('verify.daysAgo').replace('{n}', String(days))
  const label =
    status === 'fresh' ? t('verify.fresh').replace('{when}', when)
    : status === 'stale' ? t('verify.stale').replace('{when}', when)
    : status === 'changed' ? t('verify.changed')
    : t('verify.never')
  const ok = status === 'fresh'
  const BadgeIcon = ok ? ShieldCheck : ShieldAlert

  return (
    <button
      type="button"
      onClick={onCheck}
      title={t('verify.action')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        marginTop: 8, padding: '3px 9px', borderRadius: 999, border: 'none', cursor: 'pointer',
        fontSize: '0.7rem', fontWeight: 600,
        backgroundColor: ok ? 'var(--color-income-bg)' : 'var(--color-warning-bg)',
        color: ok ? 'var(--color-income)' : 'var(--color-warning)',
      }}
    >
      <BadgeIcon style={{ width: 12, height: 12, flexShrink: 0 }} aria-hidden="true" />
      {label}
    </button>
  )
}

/**
 * Opens a dialog from the URL - the dashboard reminders link here:
 * ?verify=<accountId> (balance check), ?statement=<accountId> (card statement check),
 * ?transfer=<plannedTransferId> (log a planned transfer that's due).
 */
function DialogFromUrl({ onVerify, onStatement, onPlannedTransfer }: {
  onVerify: (accountId: string) => void
  onStatement: (accountId: string) => void
  onPlannedTransfer: (plannedTransferId: string) => void
}) {
  const searchParams = useSearchParams()
  const verify = searchParams.get('verify')
  const statement = searchParams.get('statement')
  const transfer = searchParams.get('transfer')
  useEffect(() => { if (verify) onVerify(verify) }, [verify, onVerify])
  useEffect(() => { if (statement) onStatement(statement) }, [statement, onStatement])
  useEffect(() => { if (transfer) onPlannedTransfer(transfer) }, [transfer, onPlannedTransfer])
  return null
}

function CardActionButton({ onClick, icon: Icon, children }: {
  onClick: () => void
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        flex: 1, minWidth: 0, height: 34, borderRadius: 10,
        border: '1px solid var(--color-border)',
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)'
        e.currentTarget.style.backgroundColor = 'var(--color-sage)'
        e.currentTarget.style.color = 'var(--color-accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)'
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-secondary)'
      }}
    >
      <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
      {children}
    </button>
  )
}

function AccountCard({
  account,
  t,
  canPayCard,
  onEdit,
  onArchive,
  onUnarchive,
  onPayCard,
  onAdjust,
  onVerify,
  onCheckStatement,
}: {
  account: Account
  t: (key: TranslationKey) => string
  /** True when the user has at least one non-credit account to pay this card from. */
  canPayCard: boolean
  onEdit: () => void
  onArchive: () => void
  onUnarchive: () => void
  onPayCard: () => void
  onAdjust: () => void
  onVerify: () => void
  onCheckStatement: () => void
}) {
  const Icon = TYPE_ICON[account.type] ?? Wallet
  const isCredit = account.type === 'credit'

  // Each account is shown in its OWN currency - amounts across currencies are never
  // summed or converted (no FX in this phase).
  const fmt = (v: number) => formatCurrencyAmount(v, account.currency)

  // Derived on read from transactions (see lib/services/accountBalance.ts) - never stored.
  const displayBalance = isCredit ? (account.outstandingBalance ?? 0) : (account.computedBalance ?? account.openingBalance)

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      opacity: account.isArchived ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            backgroundColor: 'var(--color-sage)',
            color: 'var(--color-accent)',
          }}>
            <Icon style={{ width: 17, height: 17 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontWeight: 700, fontSize: '0.9rem',
              color: 'var(--color-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {account.name}
            </h3>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {t(TYPE_LABEL_KEY[account.type])}
              {account.institution ? ` · ${account.institution}` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            aria-label={t('common.edit')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--color-text-muted)', cursor: 'pointer',
            }}
          >
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          <button
            onClick={account.isArchived ? onUnarchive : onArchive}
            aria-label={account.isArchived ? t('account.unarchive') : t('account.deleteConfirm')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--color-text-muted)', cursor: 'pointer',
            }}
          >
            {account.isArchived
              ? <ArchiveRestore style={{ width: 13, height: 13 }} />
              : <Archive style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      <div>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {isCredit ? t('account.outstanding') : 'Balance'}
        </span>
        <div style={{
          fontSize: '1.25rem', fontWeight: 800,
          color: isCredit
            ? (displayBalance > 0 ? 'var(--color-expense)' : 'var(--color-text-primary)')
            : displayBalance < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmt(displayBalance)}
        </div>
        {isCredit && account.creditLimit != null && (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {t('account.available')}: {fmt(account.availableCredit ?? account.creditLimit)}
            </div>
            <CreditUtilizationBar outstanding={displayBalance} limit={account.creditLimit} />
          </>
        )}
        {isCredit && account.dueDay != null && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
            Payment due day: {account.dueDay}
          </div>
        )}
        {!account.isArchived && (
          <div><VerificationBadge account={account} t={t} onCheck={onVerify} /></div>
        )}
      </div>

      {!account.isArchived && account.statementDue && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 12px', borderRadius: 10,
          backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)',
        }}>
          <Receipt style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true" />
          <span style={{ fontSize: '0.78rem', flex: '1 1 160px', lineHeight: 1.4 }}>
            {t('statement.due').replace('{date}', format(new Date(`${account.statementDue}T12:00:00`), 'MMM d'))}
          </span>
          <button
            type="button"
            onClick={onCheckStatement}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-warning)', textDecoration: 'underline' }}
          >
            {t('statement.check')}
          </button>
        </div>
      )}

      {!account.isArchived && account.adjustmentPattern && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '10px 12px', borderRadius: 10,
          backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-secondary)',
          fontSize: '0.75rem', lineHeight: 1.45,
        }}>
          <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {t('pattern.title')
                .replace('{days}', String(account.adjustmentPattern.days))
                .replace('{n}', String(account.adjustmentPattern.count))
                .replace('{amount}', `${account.adjustmentPattern.net >= 0 ? '+' : '−'}${fmt(Math.abs(account.adjustmentPattern.net))}`)}
            </strong>
            {' '}
            {/* Bank lower than WaiseKa (asset) or owing more (card) points at unlogged spending */}
            {t(
              isCredit
                ? (account.adjustmentPattern.net > 0 ? 'pattern.spendingCredit' : 'pattern.paymentsCredit')
                : (account.adjustmentPattern.net < 0 ? 'pattern.spendingAsset' : 'pattern.incomeAsset')
            )}
          </span>
        </div>
      )}

      {!account.isArchived && (
        <div style={{ display: 'flex', gap: 8 }}>
          {isCredit && canPayCard && (
            <CardActionButton onClick={onPayCard} icon={CreditCard}>Pay this card</CardActionButton>
          )}
          <CardActionButton onClick={onVerify} icon={ShieldCheck}>{t('verify.action')}</CardActionButton>
          <CardActionButton onClick={onAdjust} icon={SlidersHorizontal}>{t('adjust.action')}</CardActionButton>
        </div>
      )}

      {account.isArchived && (
        <span style={{
          fontSize: '0.62rem', fontWeight: 700,
          padding: '2px 8px', borderRadius: 999, alignSelf: 'flex-start',
          backgroundColor: 'var(--color-elevated)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {t('account.archived')}
        </span>
      )}
    </div>
  )
}

export default function AccountsPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { accounts, loading, archiveAccount, unarchiveAccount, refetch } = useAccounts()

  const [addOpen, setAddOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  // Title follows the form: picking a card as the destination makes it a payment
  const [transferIsCardPayment, setTransferIsCardPayment] = useState(false)
  const [payCardAccount, setPayCardAccount] = useState<Account | null>(null)
  const [showCapBanner, setShowCapBanner] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [adjustAccount, setAdjustAccount] = useState<Account | null>(null)

  // Balance check dialog. Held by id so a ?verify= link works once accounts have loaded.
  const router = useRouter()
  const [verifyAccountId, setVerifyAccountId] = useState<string | null>(null)
  const verifyAccount = accounts.find((a) => a._id === verifyAccountId && !a.isArchived) ?? null
  // Drop ?verify= / ?statement= / ?transfer= once handled, so a refresh doesn't reopen the dialog
  const clearUrl = useCallback(() => {
    if (window.location.search) router.replace('/accounts', { scroll: false })
  }, [router])
  const closeVerify = useCallback(() => {
    setVerifyAccountId(null)
    clearUrl()
  }, [clearUrl])

  // Card statement check: the adjust form, opened on the statement's closing date
  const [statementAccountId, setStatementAccountId] = useState<string | null>(null)
  const statementAccount = accounts.find((a) => a._id === statementAccountId && !a.isArchived) ?? null
  const closeStatement = useCallback(() => {
    setStatementAccountId(null)
    clearUrl()
  }, [clearUrl])

  // A planned transfer that's due, opened pre-filled from the dashboard reminder
  const [plannedTransfer, setPlannedTransfer] = useState<{ fromAccountId: string; toAccountId: string; amount: number } | null>(null)
  const openPlannedTransfer = useCallback((id: string) => {
    fetch('/api/planned-transfers')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { _id: string; fromAccountId: string; toAccountId: string; amount: number }[]) => {
        const plan = Array.isArray(list) ? list.find((p) => p._id === id) : undefined
        if (plan) setPlannedTransfer({ fromAccountId: plan.fromAccountId, toAccountId: plan.toAccountId, amount: plan.amount })
      })
      .catch(() => {})
  }, [])
  const closePlannedTransfer = useCallback(() => {
    setPlannedTransfer(null)
    clearUrl()
  }, [clearUrl])

  // Transactions with no account never move a balance - a common reason WaiseKa and the bank disagree
  const [unlinkedCount, setUnlinkedCount] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/transactions?accountId=unassigned&limit=1', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && typeof data.total === 'number') setUnlinkedCount(data.total) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])
  const archivedAccounts = useMemo(() => accounts.filter((a) => a.isArchived), [accounts])

  const creditAccounts = useMemo(
    () => activeAccounts.filter((a) => a.type === 'credit'),
    [activeAccounts]
  )
  // A card can only be paid if there's at least one non-credit account to pay from.
  const canPayCard = useMemo(
    () => activeAccounts.some((a) => a.type !== 'credit'),
    [activeAccounts]
  )
  // Totals are grouped by currency, never summed across currencies (no FX conversion).
  const moneyByCurrency = useMemo(
    () => sumByCurrency(
      activeAccounts
        .filter((a) => a.type !== 'credit' && a.includeInTotal)
        .map((a) => ({ currency: a.currency, value: a.computedBalance ?? a.openingBalance }))
    ),
    [activeAccounts]
  )
  const owedByCurrency = useMemo(
    () => sumByCurrency(creditAccounts.map((a) => ({ currency: a.currency, value: a.outstandingBalance ?? 0 }))),
    [creditAccounts]
  )

  const handleArchive = async (account: Account) => {
    try {
      await archiveAccount(account._id)
      toast('Account archived', 'success')
    } catch {
      toast('Failed to archive account', 'error')
    }
  }

  const handleUnarchive = async (account: Account) => {
    try {
      await unarchiveAccount(account._id)
      toast('Account restored', 'success')
    } catch {
      toast('Failed to restore account', 'error')
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 900,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-playfair), Georgia, serif',
            lineHeight: 1.1,
          }}>
            {t('account.title')}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {activeAccounts.length} account(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {activeAccounts.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => { setTransferIsCardPayment(false); setTransferOpen(true) }}>
              <ArrowLeftRight style={{ width: 14, height: 14, marginRight: 4 }} />
              <span className="hidden sm:inline">Transfer</span>
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
            <span className="hidden sm:inline">{t('account.add')}</span>
          </Button>
        </div>
      </div>

      {/* ── Summary tiles ─────────────────────────────────────────────────────── */}
      {activeAccounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{
            backgroundColor: 'var(--color-card)', borderRadius: 16,
            border: '1px solid var(--color-border)', padding: '18px 20px',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('account.totalMoney')}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[...moneyByCurrency.entries()].map(([currency, total]) => (
                <div key={currency} style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-income)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyAmount(total, currency)}
                </div>
              ))}
            </div>
          </div>
          {creditAccounts.length > 0 && (
            <div style={{
              backgroundColor: 'var(--color-card)', borderRadius: 16,
              border: '1px solid var(--color-border)', padding: '18px 20px',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {t('account.totalOwed')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...owedByCurrency.entries()].map(([currency, total]) => (
                  <div key={currency} style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-expense)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyAmount(total, currency)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Unlinked transactions notice ─────────────────────────────────────── */}
      {unlinkedCount > 0 && activeAccounts.length > 0 && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px', borderRadius: 12,
          backgroundColor: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
        }}>
          <Info style={{ width: 16, height: 16, flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', flex: '1 1 220px', lineHeight: 1.5, margin: 0 }}>
            {unlinkedCount === 1
              ? t('adjust.unlinkedOne')
              : t('adjust.unlinked').replace('{n}', String(unlinkedCount))}
          </p>
          <Link
            href="/transactions?account=unassigned"
            style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-warning)', textDecoration: 'underline', flexShrink: 0 }}
          >
            {t('adjust.unlinkedAction')}
          </Link>
        </div>
      )}

      {/* ── Free-tier cap banner ─────────────────────────────────────────────── */}
      {showCapBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 12,
          backgroundColor: 'var(--color-sage)',
          border: '1px solid var(--color-accent)',
        }}>
          <Lock style={{ width: 16, height: 16, color: 'var(--color-accent)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--color-accent)', flex: 1, lineHeight: 1.5 }}>
            You&apos;ve reached the free plan limit of 5 accounts.{' '}
            <strong>Upgrade to Premium</strong> to add more.
          </p>
          <button
            onClick={() => setShowCapBanner(false)}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-accent)', lineHeight: 1, padding: 0, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : activeAccounts.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-card)', borderRadius: 16,
          border: '1px solid var(--color-border)', padding: '64px 24px',
          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            {t('account.createFirst')}
          </p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus style={{ width: 14, height: 14, marginRight: 6 }} />
            {t('account.create')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 16 }}>
          {activeAccounts.map((account) => (
            <AccountCard
              key={account._id}
              account={account}
              t={t}
              canPayCard={canPayCard}
              onEdit={() => setEditAccount(account)}
              onArchive={() => handleArchive(account)}
              onUnarchive={() => handleUnarchive(account)}
              onPayCard={() => setPayCardAccount(account)}
              onAdjust={() => setAdjustAccount(account)}
              onVerify={() => setVerifyAccountId(account._id)}
              onCheckStatement={() => setStatementAccountId(account._id)}
            />
          ))}
        </div>
      )}

      {/* ── Archived accounts ────────────────────────────────────────────────── */}
      {archivedAccounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            {t('account.archived')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 16 }}>
            {archivedAccounts.map((account) => (
              <AccountCard
                key={account._id}
                account={account}
                t={t}
                canPayCard={false}
                onEdit={() => setEditAccount(account)}
                onArchive={() => handleArchive(account)}
                onUnarchive={() => handleUnarchive(account)}
                onPayCard={() => {}}
                onAdjust={() => {}}
                onVerify={() => {}}
                onCheckStatement={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Transfer modal ───────────────────────────────────────────────────── */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={transferIsCardPayment ? "Pay card" : "Transfer"} variant="form">
        <TransferForm
          accounts={accounts}
          onCardPaymentChange={setTransferIsCardPayment}
          onSuccess={() => { setTransferOpen(false); refetch() }}
          onCancel={() => setTransferOpen(false)}
        />
      </Modal>

      {/* ── Pay card modal (transfer with locked credit destination) ──────────── */}
      <Modal open={!!payCardAccount} onClose={() => setPayCardAccount(null)} title="Pay card" variant="form">
        {payCardAccount && (
          <TransferForm
            accounts={accounts}
            lockedToAccountId={payCardAccount._id}
            onSuccess={() => { setPayCardAccount(null); refetch() }}
            onCancel={() => setPayCardAccount(null)}
          />
        )}
      </Modal>

      {/* ── Balance check (also opened from the dashboard via ?verify=) ──────── */}
      <Suspense fallback={null}>
        <DialogFromUrl onVerify={setVerifyAccountId} onStatement={setStatementAccountId} onPlannedTransfer={openPlannedTransfer} />
      </Suspense>
      <Modal open={!!verifyAccount} onClose={closeVerify} title={t('verify.title')} variant="form">
        {verifyAccount && (
          <VerifyBalanceForm
            account={verifyAccount}
            onVerified={() => { closeVerify(); refetch() }}
            onMismatch={() => { closeVerify(); setAdjustAccount(verifyAccount) }}
            onCancel={closeVerify}
          />
        )}
      </Modal>

      {/* ── Card statement check ─────────────────────────────────────────────── */}
      <Modal open={!!statementAccount?.statementDue} onClose={closeStatement} title={t('statement.check')} variant="form">
        {statementAccount?.statementDue && (
          <AdjustBalanceForm
            account={statementAccount}
            statementDate={statementAccount.statementDue}
            onSuccess={() => { closeStatement(); refetch() }}
            onCancel={closeStatement}
          />
        )}
      </Modal>

      {/* ── Planned transfer that's due ──────────────────────────────────────── */}
      <Modal open={!!plannedTransfer} onClose={closePlannedTransfer} title="Transfer" variant="form">
        {plannedTransfer && (
          <TransferForm
            accounts={accounts}
            initial={plannedTransfer}
            onSuccess={() => { closePlannedTransfer(); refetch() }}
            onCancel={closePlannedTransfer}
          />
        )}
      </Modal>

      {/* ── Adjust balance modal ─────────────────────────────────────────────── */}
      <Modal open={!!adjustAccount} onClose={() => setAdjustAccount(null)} title={t('adjust.title')} variant="form">
        {adjustAccount && (
          <AdjustBalanceForm
            account={adjustAccount}
            onSuccess={() => { setAdjustAccount(null); refetch() }}
            onCancel={() => setAdjustAccount(null)}
          />
        )}
      </Modal>

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('account.create')} variant="form">
        <AccountForm
          onSuccess={() => { setAddOpen(false); refetch() }}
          onCancel={() => setAddOpen(false)}
          onCapHit={() => setShowCapBanner(true)}
        />
      </Modal>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editAccount} onClose={() => setEditAccount(null)} title={t('account.editTitle')} variant="form">
        {editAccount && (
          <AccountForm
            account={editAccount}
            onSuccess={() => { setEditAccount(null); refetch() }}
            onCancel={() => setEditAccount(null)}
          />
        )}
      </Modal>
    </div>
  )
}
