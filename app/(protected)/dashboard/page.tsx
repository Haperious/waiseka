'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, MailWarning } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import SurveyBanner from '@/components/SurveyBanner'
import AnnouncementModal, { PendingAnnouncement } from '@/components/AnnouncementModal'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useCurrency } from '@/context/CurrencyContext'
import { useSession } from 'next-auth/react'
import { isPremium } from '@/lib/tier'
import { useLanguage } from '@/context/LanguageContext'
import type { Budget } from '@/hooks/useBudgets'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useToast } from '@/components/ui/Toast'
import TransactionForm from '../transactions/TransactionForm'
import { onTransactionSaved } from '@/lib/transactionEvents'
import TotalMoneyCard from '@/components/dashboard/TotalMoneyCard'
import CutoffCard, { type CutoffData } from '@/components/dashboard/CutoffCard'
import NeedsTodayRow, { type InsightItem } from '@/components/dashboard/NeedsTodayRow'
import LastThreeMonthsBand, { type RangeMonth, type CategoryMover } from '@/components/dashboard/LastThreeMonthsBand'
import RecentActivityCard from '@/components/dashboard/RecentActivityCard'

interface Summary {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: { category: string; total: number; percentage: number }[]
}

// ── Budget progress bar ──────────────────────────────────────────────────────
function BudgetBar({ budget, formatAmount }: { budget: Budget; formatAmount: (v: number) => string }) {
  const pct = Math.min((budget.spent / budget.limit) * 100, 100)
  const barColor =
    pct >= 90 ? 'var(--color-expense)' :
    pct >= 70 ? 'var(--color-warning)' :
    'var(--color-income)'

  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {budget.color && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: budget.color, flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: '0.83rem', fontWeight: '500', color: 'var(--color-text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '14ch',
          }}>
            {budget.category}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {formatAmount(budget.spent)} / {formatAmount(budget.limit)}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: '700',
            padding: '1px 7px', borderRadius: 999,
            backgroundColor:
              pct >= 90 ? 'var(--color-expense-bg)' :
              pct >= 70 ? 'var(--color-warning-bg)' :
              'var(--color-income-bg)',
            color: barColor,
          }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div style={{
        height: 5, borderRadius: 999,
        backgroundColor: 'var(--color-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          backgroundColor: barColor,
          width: animated ? `${pct}%` : '0%',
          transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { formatAmount } = useCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  const [addTxOpen,       setAddTxOpen]       = useState(false)
  const [selectedYear,    setSelectedYear]    = useState(String(currentYear))
  const [selectedMonth,   setSelectedMonth]   = useState(String(currentMonth))
  const [analyticsSummary, setAnalyticsSummary] = useState<Summary | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [budgets,          setBudgets]          = useState<Budget[]>([])
  const [budgetsLoading,   setBudgetsLoading]   = useState(true)
  const { accounts, loading: accountsLoading } = useAccounts()

  // ── Dashboard v2: cutoff card, "needs you today", last-3-months band ─────
  const [cutoffData,    setCutoffData]    = useState<CutoffData | null>(null)
  const [cutoffLoading, setCutoffLoading] = useState(true)
  const [insights,        setInsights]        = useState<InsightItem[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [rangeMonths,    setRangeMonths]    = useState<RangeMonth[]>([])
  const [rangeMovers,    setRangeMovers]    = useState<CategoryMover[]>([])
  const [rangeLoading,   setRangeLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/summary/cutoff')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCutoffData(data))
      .catch(() => {})
      .finally(() => setCutoffLoading(false))

    fetch('/api/insights/today')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setInsights(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setInsightsLoading(false))

    fetch('/api/summary/range')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setRangeMonths(data?.months ?? [])
        setRangeMovers(data?.movers ?? [])
      })
      .catch(() => {})
      .finally(() => setRangeLoading(false))
  }, [])

  const { data: session } = useSession()
  const userIsPremium = session?.user ? isPremium(session.user as { tier: string; premiumOverride: boolean }) : false
  const isVerified = session?.user?.isVerified ?? true

  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  const handleResendVerification = async () => {
    setResendLoading(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) {
        setResendSent(true)
        toast('Verification email sent! Check your inbox.', 'success')
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to send verification email', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setResendLoading(false)
    }
  }

  const { refetch } = useTransactions({ limit: 1 })

  const MONTHS = useMemo(() => [
    { value: '1',  label: t('common.january')   },
    { value: '2',  label: t('common.february')  },
    { value: '3',  label: t('common.march')     },
    { value: '4',  label: t('common.april')     },
    { value: '5',  label: t('common.may')       },
    { value: '6',  label: t('common.june')      },
    { value: '7',  label: t('common.july')      },
    { value: '8',  label: t('common.august')    },
    { value: '9',  label: t('common.september') },
    { value: '10', label: t('common.october')   },
    { value: '11', label: t('common.november')  },
    { value: '12', label: t('common.december')  },
  ], [t])

  const years = useMemo(
    () => Array.from({ length: userIsPremium ? 5 : 3 }, (_, i) => {
      const y = currentYear - i
      return { value: String(y), label: String(y) }
    }),
    [currentYear, userIsPremium],
  )

  const loadAnalyticsSummary = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const res  = await fetch(`/api/summary?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setAnalyticsSummary(data)
    } catch { /* ignore */ }
    finally  { setAnalyticsLoading(false) }
  }, [selectedMonth, selectedYear])

  const loadBudgets = useCallback(async () => {
    setBudgetsLoading(true)
    try {
      const res  = await fetch(`/api/budgets?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setBudgets(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    finally  { setBudgetsLoading(false) }
  }, [selectedMonth, selectedYear])

  useEffect(() => { loadAnalyticsSummary() }, [loadAnalyticsSummary])
  useEffect(() => { loadBudgets() },          [loadBudgets])

  // Load pending feature announcements - at most once per browser session, guarded by a
  // per-user sessionStorage flag. The flag is a presentation-layer guard only; the
  // announcementViews collection is the source of truth for what's actually been seen,
  // so clearing sessionStorage re-checks but never resurfaces an already-dismissed card.
  const [pendingAnnouncements, setPendingAnnouncements] = useState<PendingAnnouncement[]>([])
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    const checkedKey = `waiseka_announcements_checked_${session.user.id}`
    if (sessionStorage.getItem(checkedKey)) return
    sessionStorage.setItem(checkedKey, '1')

    fetch('/api/announcements/pending')
      .then((r) => r.json())
      .then((data) => {
        if (data.announcements?.length) {
          setPendingAnnouncements(data.announcements)
          setAnnouncementModalOpen(true)
        }
      })
      .catch(() => { /* non-critical */ })
  }, [session?.user?.id])

  // Compute Pera Health Score 0-100
  const { score, statusLabel } = useMemo(() => {
    if (!analyticsSummary) return { score: 0, statusLabel: t('dashboard.healthy') }
    const { savingsRate, netSavings } = analyticsSummary
    let s = 0
    if      (savingsRate >= 20) s += 60
    else if (savingsRate >= 10) s += 40
    else if (savingsRate >= 5)  s += 20
    else if (savingsRate >  0)  s += 10

    if (budgets.length > 0) {
      const allUnder80  = budgets.every(b => (b.spent / b.limit) < 0.8)
      const allUnder100 = budgets.every(b => b.spent <= b.limit)
      if      (allUnder80)  s += 40
      else if (allUnder100) s += 20
      else                  s += 5
    } else {
      s += 20
    }

    if (netSavings < 0) s = Math.max(0, s - 20)

    const sl =
      s >= 70 ? t('dashboard.healthy') :
      s >= 45 ? t('dashboard.acceptable') :
      s >= 20 ? t('dashboard.needsAttention') :
      t('dashboard.alert')

    return { score: Math.min(s, 100), statusLabel: sl }
  }, [analyticsSummary, budgets, t])

  const selectedMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label ?? ''

  // Shared by the "Total Money" card
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])
  const moneyByCurrency = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of activeAccounts) {
      if (a.type === 'credit' || !a.includeInTotal) continue
      map.set(a.currency, (map.get(a.currency) ?? 0) + (a.computedBalance ?? a.openingBalance))
    }
    return map
  }, [activeAccounts])
  const totalMoney = useMemo(
    () => [...moneyByCurrency.values()].reduce((sum, v) => sum + v, 0),
    [moneyByCurrency]
  )

  const budgetsNeedingAttention = useMemo(
    () => budgets.filter((b) => b.limit > 0 && b.spent / b.limit >= 0.9).length,
    [budgets],
  )

  const onTransactionSuccess = useCallback(() => {
    setAddTxOpen(false)
    refetch()
    loadAnalyticsSummary()
    loadBudgets()
  }, [refetch, loadAnalyticsSummary, loadBudgets])

  // Refresh dashboard data when the mobile quick-add sheet saves a transaction
  useEffect(() => onTransactionSaved(() => {
    refetch()
    loadAnalyticsSummary()
    loadBudgets()
  }), [refetch, loadAnalyticsSummary, loadBudgets])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>
            {t('dashboard.greeting')} {selectedMonthLabel} {selectedYear}
          </p>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {t('dashboard.title')}
          </h1>
        </div>
        <Button onClick={() => setAddTxOpen(true)} size="sm" className="hidden sm:inline-flex sm:h-8 sm:px-3 sm:text-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          <span>{t('dashboard.addTransaction')}</span>
        </Button>
      </div>

      {/* ── Period selector ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 130, flex: '1 1 130px', maxWidth: 180 }}>
          <Select value={selectedMonth} onValueChange={setSelectedMonth} options={MONTHS} />
        </div>
        <div style={{ minWidth: 90, flex: '0 0 auto' }}>
          <Select value={selectedYear} onValueChange={setSelectedYear} options={years} />
        </div>
      </div>

      {/* ── Email verification banner ──────────────────────────────────── */}
      {!isVerified && (
        <div style={{
          borderRadius: 12,
          backgroundColor: 'var(--color-warning-bg)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-warning)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <MailWarning style={{ width: 18, height: 18, color: 'var(--color-warning)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', lineHeight: 1.5, flex: 1 }}>
            Your email address hasn&apos;t been verified. Check your inbox or resend the verification email.
          </p>
          <button
            onClick={handleResendVerification}
            disabled={resendLoading || resendSent}
            style={{
              flexShrink: 0,
              fontSize: '0.78rem',
              fontWeight: 600,
              color: resendSent ? 'var(--color-income)' : 'var(--color-warning)',
              background: 'none',
              border: 'none',
              cursor: resendLoading || resendSent ? 'default' : 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              opacity: resendLoading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {resendSent ? 'Email sent!' : resendLoading ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      )}

      {/* ── Feature announcement modal ───────────────────────────────── */}
      <AnnouncementModal
        open={announcementModalOpen}
        announcements={pendingAnnouncements}
        onClose={() => setAnnouncementModalOpen(false)}
      />

      {/* ── Survey banner ───────────────────────────────────────────── */}
      {session?.user?.id && session?.user?.createdAt && (
        <SurveyBanner userId={session.user.id} accountCreatedAt={session.user.createdAt} />
      )}

      {/* ── Total Money + Cutoff row ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18 }} className="max-lg:!grid-cols-1">
        <TotalMoneyCard
          totalMoney={totalMoney}
          accountCount={activeAccounts.filter((a) => a.includeInTotal && a.type !== 'credit').length}
          healthScore={score}
          healthStatusLabel={statusLabel}
          accounts={activeAccounts}
          formatAmount={formatAmount}
        />
        <CutoffCard data={cutoffData} loading={cutoffLoading} formatAmount={formatAmount} />
      </div>

      {/* ── Needs you today ──────────────────────────────────────────── */}
      <NeedsTodayRow items={insights} loading={insightsLoading} />

      {/* ── Recent activity + Budgets ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="max-lg:!grid-cols-1">
        <RecentActivityCard formatAmount={formatAmount} />

        <div style={{
          backgroundColor: 'var(--color-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {t('dashboard.budgetOverview')}
            </p>
            {budgetsNeedingAttention > 0 && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                backgroundColor: 'var(--color-expense-bg)', color: 'var(--color-expense)',
              }}>
                {budgetsNeedingAttention} need attention
              </span>
            )}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {budgetsLoading ? (
              <>{[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</>
            ) : budgets.length === 0 ? (
              <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                {t('dashboard.noBudgets')}
              </p>
            ) : (
              budgets.slice(0, 6).map(b => (
                <BudgetBar key={b._id} budget={b} formatAmount={formatAmount} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Last 3 months band ────────────────────────────────────────── */}
      <LastThreeMonthsBand months={rangeMonths} movers={rangeMovers} loading={rangeLoading} formatAmount={formatAmount} />

      {/* ── Add transaction modal ───────────────────────────────────────── */}
      <Modal open={addTxOpen} onClose={() => setAddTxOpen(false)} title={t('dashboard.addTransaction')}>
        <TransactionForm
          onSuccess={onTransactionSuccess}
          onCancel={() => setAddTxOpen(false)}
        />
      </Modal>
    </div>
  )
}
