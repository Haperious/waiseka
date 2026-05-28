'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, PiggyBank, Percent, Plus, Lightbulb,
} from 'lucide-react'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { TranslationKey } from '@/lib/translations'
import Link from 'next/link'
import type { Budget } from '@/hooks/useBudgets'
import type { Goal } from '@/hooks/useGoals'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionForm from '../transactions/TransactionForm'
import dynamic from 'next/dynamic'

const IncomeExpenseChart = dynamic(() => import('@/components/charts/IncomeExpenseChart'), { ssr: false })

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Category bar color palette — sage-adjacent, works dark + light
const CAT_COLORS = [
  '#166534', '#16A34A', '#4ADE80', '#84CC16',
  '#D97706', '#B45309', '#2563EB', '#7C3AED',
]

interface Summary {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: { category: string; total: number; percentage: number }[]
}

// ── Pera Health Score ring ───────────────────────────────────────────────────
function HealthRing({
  score,
  label,
  statusKey,
}: {
  score: number
  label: string
  statusKey: string
}) {
  const r = 50
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ

  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(t)
  }, [score])

  const ringColor =
    score >= 70 ? 'var(--color-income)' :
    score >= 45 ? 'var(--color-warning)' :
    'var(--color-expense)'

  const statusBg =
    score >= 70 ? 'var(--color-income-bg)' :
    score >= 45 ? 'var(--color-warning-bg)' :
    'var(--color-expense-bg)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 148, height: 148 }}>
        <svg
          viewBox="0 0 120 120"
          style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
        >
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-elevated)" strokeWidth="9" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={ringColor} strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={animated ? `${offset}` : `${circ}`}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '1.9rem', fontWeight: '800',
            color: ringColor, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {score}
          </span>
          <span style={{
            fontSize: '0.55rem', color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3,
          }}>
            {label}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.75rem', fontWeight: '600',
        padding: '3px 12px', borderRadius: 999,
        backgroundColor: statusBg,
        color: ringColor,
        letterSpacing: '0.02em',
      }}>
        {statusKey}
      </span>
    </div>
  )
}

// ── Individual stat card ─────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, type, loading,
}: {
  label: string
  value: string
  icon: React.ElementType
  type: 'income' | 'expense' | 'savings' | 'rate'
  loading: boolean
}) {
  const accent =
    type === 'income'  ? 'var(--color-income)'   :
    type === 'expense' ? 'var(--color-expense)'  :
    type === 'savings' ? 'var(--color-savings)'  :
    'var(--color-accent)'

  const bg =
    type === 'income'  ? 'var(--color-income-bg)'  :
    type === 'expense' ? 'var(--color-expense-bg)' :
    type === 'savings' ? 'var(--color-savings-bg)' :
    'var(--color-sage)'

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      borderRadius: 14,
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${accent}`,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{
          fontSize: '0.68rem', textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--color-text-muted)',
          fontWeight: 600,
        }}>
          {label}
        </p>
        <div style={{
          background: bg, borderRadius: 9,
          padding: '6px', display: 'flex', alignItems: 'center',
        }}>
          <Icon style={{ width: 14, height: 14, color: accent }} />
        </div>
      </div>
      {loading
        ? <Skeleton className="h-8 w-28" />
        : <p style={{
            fontSize: '1.55rem', fontWeight: '800',
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {value}
          </p>
      }
    </div>
  )
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
          <span style={{ fontSize: '0.83rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
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

// ── Category horizontal bar ──────────────────────────────────────────────────
function CategoryBar({
  cat, color, formatAmount,
}: {
  cat: { category: string; total: number; percentage: number }
  color: string
  formatAmount: (v: number) => string
}) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
            {cat.category}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {formatAmount(cat.total)}
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: '600', color, minWidth: 32, textAlign: 'right' }}>
            {cat.percentage}%
          </span>
        </div>
      </div>
      <div style={{
        height: 4, borderRadius: 999,
        backgroundColor: 'var(--color-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 999,
          backgroundColor: color,
          opacity: 0.85,
          width: animated ? `${cat.percentage}%` : '0%',
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

// ── Goal progress row ────────────────────────────────────────────────────────
function GoalBar({
  goal,
  formatAmount,
  t,
}: {
  goal: Goal
  formatAmount: (v: number) => string
  t: (k: TranslationKey) => string
}) {
  const pct       = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0
  const isComplete = goal.status === 'completed' || pct >= 100
  const isPaused   = goal.status === 'paused'

  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(id)
  }, [])

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
    : null

  const priorityColor =
    goal.priority === 'high'   ? 'var(--color-expense)'  :
    goal.priority === 'medium' ? 'var(--color-warning)'  :
    'var(--color-income)'

  const barColor = isComplete ? 'var(--color-income)' : isPaused ? 'var(--color-text-muted)' : priorityColor

  const deadlineStyle = daysLeft === null || isComplete ? null :
    daysLeft <  0 ? { bg: 'var(--color-expense-bg)',  fg: 'var(--color-expense)'  } :
    daysLeft < 30 ? { bg: 'var(--color-warning-bg)',  fg: 'var(--color-warning)'  } :
                    { bg: 'var(--color-pale)',         fg: 'var(--color-text-muted)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {/* Left: dot + title + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            backgroundColor: priorityColor,
          }} />
          <span style={{
            fontSize: '0.83rem', fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {goal.title}
          </span>
          {isComplete && (
            <span style={{
              fontSize: '0.63rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, flexShrink: 0,
              backgroundColor: 'var(--color-income-bg)', color: 'var(--color-income)',
            }}>
              {t('goal.completed')}
            </span>
          )}
          {isPaused && !isComplete && (
            <span style={{
              fontSize: '0.63rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, flexShrink: 0,
              backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-muted)',
            }}>
              {t('dashboard.goalPaused')}
            </span>
          )}
        </div>

        {/* Right: amounts + pct + deadline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {formatAmount(goal.savedAmount)}{' '}
            <span style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>/</span>{' '}
            {formatAmount(goal.targetAmount)}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
            backgroundColor: isComplete ? 'var(--color-income-bg)' : 'var(--color-elevated)',
            color: isComplete ? 'var(--color-income)' : 'var(--color-text-secondary)',
          }}>
            {Math.round(pct)}%
          </span>
          {deadlineStyle && daysLeft !== null && (
            <span style={{
              fontSize: '0.63rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
              backgroundColor: deadlineStyle.bg, color: deadlineStyle.fg,
            }}>
              {daysLeft < 0 ? t('dashboard.overdue') : `${daysLeft}d`}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 999, backgroundColor: 'var(--color-elevated)', overflow: 'hidden' }}>
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
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()

  const [addTxOpen,       setAddTxOpen]       = useState(false)
  const [selectedYear,    setSelectedYear]    = useState(String(currentYear))
  const [selectedMonth,   setSelectedMonth]   = useState(String(currentMonth))
  const [allMonths,       setAllMonths]       = useState<{ month: string; income: number; expenses: number; savings: number }[]>([])
  const [analyticsSummary, setAnalyticsSummary] = useState<Summary | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [yearlyLoading,    setYearlyLoading]    = useState(true)
  const [budgets,          setBudgets]          = useState<Budget[]>([])
  const [budgetsLoading,   setBudgetsLoading]   = useState(true)
  const [goals,            setGoals]            = useState<Goal[]>([])
  const [goalsLoading,     setGoalsLoading]     = useState(true)

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
    () => Array.from({ length: 5 }, (_, i) => {
      const y = currentYear - i
      return { value: String(y), label: String(y) }
    }),
    [currentYear],
  )

  const loadYearlyTrend = useCallback(async () => {
    setYearlyLoading(true)
    const year = parseInt(selectedYear)
    const results = []
    for (let m = 1; m <= 12; m++) {
      try {
        const res = await fetch(`/api/summary?month=${m}&year=${year}`)
        const d   = await res.json()
        results.push({ month: MONTH_LABELS[m - 1], income: d.totalIncome, expenses: d.totalExpenses, savings: d.totalSavings ?? 0 })
      } catch {
        results.push({ month: MONTH_LABELS[m - 1], income: 0, expenses: 0, savings: 0 })
      }
    }
    setAllMonths(results)
    setYearlyLoading(false)
  }, [selectedYear])

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

  const loadGoals = useCallback(async () => {
    setGoalsLoading(true)
    try {
      const res  = await fetch('/api/goals')
      const data = await res.json()
      // Sort: active first, then paused, then completed
      const sorted = (Array.isArray(data) ? data : []).sort((a: Goal, b: Goal) => {
        const order = { active: 0, paused: 1, completed: 2 }
        return (order[a.status] ?? 0) - (order[b.status] ?? 0)
      })
      setGoals(sorted)
    } catch { /* ignore */ }
    finally  { setGoalsLoading(false) }
  }, [])

  useEffect(() => { loadYearlyTrend() },      [loadYearlyTrend])
  useEffect(() => { loadAnalyticsSummary() }, [loadAnalyticsSummary])
  useEffect(() => { loadBudgets() },          [loadBudgets])
  useEffect(() => { loadGoals() },            [loadGoals])

  // Compute Pera Health Score 0-100
  const { score, statusLabel, tipKey } = useMemo(() => {
    if (!analyticsSummary) return { score: 0, statusLabel: t('dashboard.healthy'), tipKey: 'dashboard.healthyTip' as const }
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

    const tk =
      s >= 70 ? 'dashboard.healthyTip'     as const :
      s >= 45 ? 'dashboard.acceptableTip'  as const :
      s >= 20 ? 'dashboard.attentionTip'   as const :
      'dashboard.alertTip' as const

    return { score: Math.min(s, 100), statusLabel: sl, tipKey: tk }
  }, [analyticsSummary, budgets, t])

  const selectedMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label ?? ''
  const topCategory        = analyticsSummary?.categoryBreakdown?.[0]

  const onTransactionSuccess = useCallback(() => {
    setAddTxOpen(false)
    refetch()
    loadAnalyticsSummary()
    loadBudgets()
  }, [refetch, loadAnalyticsSummary, loadBudgets])

  const hasYearlyData = allMonths.some(d => d.income > 0 || d.expenses > 0)

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
        <Button onClick={() => setAddTxOpen(true)} size="sm">
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t('dashboard.addTransaction')}</span>
        </Button>
      </div>

      {/* ── Period selector ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 160 }}>
          <Select value={selectedMonth} onValueChange={setSelectedMonth} options={MONTHS} />
        </div>
        <div style={{ width: 100 }}>
          <Select value={selectedYear} onValueChange={setSelectedYear} options={years} />
        </div>
      </div>

      {/* ── Hero: health ring + 4 stat cards ──────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 16,
        alignItems: 'stretch',
      }} className="flex-col sm:grid">
        {/* Health ring card */}
        <div style={{
          backgroundColor: 'var(--color-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          minWidth: 200,
        }}>
          <p style={{
            fontSize: '0.7rem', textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--color-text-muted)',
            fontWeight: 600, marginBottom: 8,
          }}>
            {t('dashboard.healthTitle')}
          </p>
          {analyticsLoading
            ? <Skeleton className="h-36 w-36 rounded-full" />
            : <HealthRing score={score} label={t('dashboard.healthScore')} statusKey={statusLabel} />
          }
        </div>

        {/* 2×2 stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatCard
            label={t('dashboard.totalIncome')}
            value={analyticsLoading ? '—' : formatAmount(analyticsSummary?.totalIncome ?? 0)}
            icon={TrendingUp}
            type="income"
            loading={analyticsLoading}
          />
          <StatCard
            label={t('dashboard.totalExpenses')}
            value={analyticsLoading ? '—' : formatAmount(analyticsSummary?.totalExpenses ?? 0)}
            icon={TrendingDown}
            type="expense"
            loading={analyticsLoading}
          />
          <StatCard
            label={t('dashboard.totalSavings')}
            value={analyticsLoading ? '—' : formatAmount(analyticsSummary?.totalSavings ?? 0)}
            icon={PiggyBank}
            type="savings"
            loading={analyticsLoading}
          />
          <StatCard
            label={t('dashboard.savingsRate')}
            value={analyticsLoading ? '—' : `${analyticsSummary?.savingsRate ?? 0}%`}
            icon={Percent}
            type="rate"
            loading={analyticsLoading}
          />
        </div>
      </div>

      {/* ── Insight banner ─────────────────────────────────────────────── */}
      {!analyticsLoading && topCategory && (
        <div style={{
          borderRadius: 12,
          backgroundColor: 'var(--color-sage)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-accent)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <Lightbulb style={{ width: 16, height: 16, color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            {t('dashboard.youSpent')}{' '}
            <strong style={{ color: 'var(--color-accent)' }}>{topCategory.percentage}%</strong>{' '}
            {t('dashboard.on')}{' '}
            <strong>{topCategory.category}</strong>{' '}
            {t('dashboard.thisPeriod')}
            {(analyticsSummary?.savingsRate ?? 0) > 0 && (
              <> — {t('dashboard.saving')}{' '}
                <strong style={{ color: 'var(--color-income)' }}>{analyticsSummary!.savingsRate}%</strong>{' '}
                {t('dashboard.ofYourIncome')}
              </>
            )}.{' '}
            <span style={{ color: 'var(--color-text-secondary)' }}>{t(tipKey)}</span>
          </p>
        </div>
      )}

      {/* ── Yearly chart ───────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--color-card)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
            {t('dashboard.incomeVsExpenses')} — {selectedYear}
          </h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {yearlyLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasYearlyData ? (
            <div style={{
              height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-muted)', fontSize: '0.85rem',
            }}>
              {t('dashboard.noData')} {selectedYear}
            </div>
          ) : (
            <IncomeExpenseChart data={allMonths} />
          )}
        </div>
      </div>

      {/* ── Budget health + Category breakdown ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-cols-1 lg:grid-cols-2">

        {/* Budget health */}
        <div style={{
          backgroundColor: 'var(--color-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
              {t('dashboard.budgetOverview')}
            </h2>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

        {/* Category breakdown */}
        <div style={{
          backgroundColor: 'var(--color-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
              {t('dashboard.categoryBreakdown')}
            </h2>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analyticsLoading ? (
              <>{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-full" />)}</>
            ) : !analyticsSummary || analyticsSummary.categoryBreakdown.length === 0 ? (
              <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                {t('dashboard.noTransactionData')}
              </p>
            ) : (
              analyticsSummary.categoryBreakdown.slice(0, 7).map((c, i) => (
                <CategoryBar
                  key={c.category}
                  cat={c}
                  color={CAT_COLORS[i % CAT_COLORS.length]}
                  formatAmount={formatAmount}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Goals overview ─────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--color-card)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>
            {t('dashboard.goalsOverview')}
          </h2>
          <Link
            href="/goals"
            style={{
              fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--color-accent)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {t('dashboard.viewAll')} →
          </Link>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {goalsLoading ? (
            <>{[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</>
          ) : goals.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                {t('goal.noGoals')}
              </p>
              <Link
                href="/goals"
                style={{
                  fontSize: '0.78rem', fontWeight: 600, padding: '6px 16px',
                  borderRadius: 8, textDecoration: 'none',
                  backgroundColor: 'var(--color-sage)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {t('goal.add')} →
              </Link>
            </div>
          ) : (
            <>
              {goals.slice(0, 5).map(g => (
                <GoalBar key={g._id} goal={g} formatAmount={formatAmount} t={t} />
              ))}
              {goals.length > 5 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 4 }}>
                  +{goals.length - 5} more —{' '}
                  <Link href="/goals" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>
                    {t('dashboard.viewAll')}
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>

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
