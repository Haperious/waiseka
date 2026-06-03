'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, PlusCircle, Calendar, Flag, Lock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useGoals, Goal } from '@/hooks/useGoals'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { TranslationKey } from '@/lib/translations'
import { useToast } from '@/components/ui/Toast'
import GoalForm from './GoalForm'

// ── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  high:   'var(--color-expense)',
  medium: 'var(--color-warning)',
  low:    'var(--color-income)',
}

// ── Animated SVG ring ────────────────────────────────────────────────────────
function ProgressRing({ percent, isCompleted }: { percent: number; isCompleted: boolean }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const r = 36
  const circ = 2 * Math.PI * r
  const ringColor = isCompleted ? 'var(--color-income)' : 'var(--color-accent)'
  const offset = circ - (Math.min(percent, 100) / 100) * circ

  return (
    <div style={{ position: 'relative', width: 96, height: 96 }}>
      <svg viewBox="0 0 96 96" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke="var(--color-elevated)"
          strokeWidth="7"
        />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={animated ? `${offset}` : `${circ}`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '1rem', fontWeight: 800,
          color: ringColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  )
}

// ── Goal card ────────────────────────────────────────────────────────────────
function GoalCard({
  goal,
  formatAmount,
  t,
  onEdit,
  onDelete,
  onAddFunds,
}: {
  goal: Goal
  formatAmount: (v: number) => string
  t: (key: TranslationKey) => string
  onEdit: () => void
  onDelete: () => void
  onAddFunds: () => void
}) {
  const progress = goal.targetAmount > 0
    ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)
    : 0
  const remaining = goal.targetAmount - goal.savedAmount
  const isCompleted = goal.status === 'completed'
  const isPaused = goal.status === 'paused'

  const now = Date.now()
  const deadlineMs = new Date(goal.deadline).getTime()
  const startMs = new Date(goal.createdAt).getTime()
  const totalDuration = deadlineMs - startMs
  const elapsed = now - startMs
  const expectedProgress = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 100
  const isOverdue = !isCompleted && !isPaused && now > deadlineMs
  const isOnTrack = !isOverdue && progress >= expectedProgress

  const daysLeft = Math.ceil((deadlineMs - now) / 86_400_000)

  // Status chip
  const statusChip = isCompleted
    ? { label: t('goal.completed'), color: 'var(--color-income)', bg: 'var(--color-income-bg)' }
    : isPaused
    ? { label: t('goal.paused'), color: 'var(--color-text-muted)', bg: 'var(--color-elevated)' }
    : isOverdue
    ? { label: t('goal.overdue'), color: 'var(--color-expense)', bg: 'var(--color-expense-bg)' }
    : isOnTrack
    ? { label: t('goal.onTrack'), color: 'var(--color-income)', bg: 'var(--color-income-bg)' }
    : { label: t('goal.behind'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' }

  const priorityColor = PRIORITY_COLOR[goal.priority] ?? 'var(--color-text-muted)'
  const priorityLabel =
    goal.priority === 'high'   ? t('goal.priorityHigh') :
    goal.priority === 'medium' ? t('goal.priorityMedium') :
    t('goal.priorityLow')

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontWeight: 700, fontSize: '0.92rem',
            color: 'var(--color-text-primary)',
            lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {goal.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {/* Status chip */}
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 999,
              backgroundColor: statusChip.bg,
              color: statusChip.color,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {statusChip.label}
            </span>

            {/* Priority */}
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: '0.68rem', fontWeight: 600,
              color: priorityColor,
            }}>
              <Flag style={{ width: 10, height: 10 }} />
              {priorityLabel}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            aria-label={t('common.edit')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-sage)'
              e.currentTarget.style.color = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
          >
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          <button
            onClick={onDelete}
            aria-label={t('common.delete')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'
              e.currentTarget.style.color = 'var(--color-expense)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* ── Progress ring ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
        <ProgressRing percent={progress} isCompleted={isCompleted} />
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: t('goal.saved'),   value: formatAmount(goal.savedAmount),   color: 'var(--color-text-primary)' },
          { label: t('goal.target'),  value: formatAmount(goal.targetAmount),  color: 'var(--color-text-primary)' },
          ...(remaining > 0 ? [{
            label: t('goal.remaining'),
            value: formatAmount(remaining),
            color: 'var(--color-accent)',
          }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{label}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
          </div>
        ))}

        {/* Deadline row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingTop: 4,
          borderTop: '1px solid var(--color-border)',
        }}>
          <Calendar style={{
            width: 13, height: 13, flexShrink: 0,
            color: isOverdue ? 'var(--color-expense)' : 'var(--color-text-muted)',
          }} />
          <span style={{
            fontSize: '0.75rem',
            color: isOverdue ? 'var(--color-expense)' : 'var(--color-text-muted)',
            flex: 1,
          }}>
            {format(new Date(goal.deadline), 'MMM d, yyyy')}
          </span>
          {!isCompleted && !isPaused && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 7px', borderRadius: 999,
              backgroundColor: isOverdue
                ? 'var(--color-expense-bg)'
                : daysLeft <= 30
                ? 'var(--color-warning-bg)'
                : 'var(--color-income-bg)',
              color: isOverdue
                ? 'var(--color-expense)'
                : daysLeft <= 30
                ? 'var(--color-warning)'
                : 'var(--color-income)',
            }}>
              {isOverdue
                ? t('goal.overdue')
                : `${daysLeft}d`}
            </span>
          )}
        </div>
      </div>

      {/* ── Add funds button ── */}
      {!isCompleted && !isPaused && (
        <button
          onClick={onAddFunds}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', height: 36,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
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
          <PlusCircle style={{ width: 14, height: 14 }} />
          {t('goal.addFunds')}
        </button>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { formatAmount } = useCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { goals, loading, deleteGoal, addFunds, refetch } = useGoals()

  const [addOpen, setAddOpen] = useState(false)
  const [showCapBanner, setShowCapBanner] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [deleteGoalItem, setDeleteGoalItem] = useState<Goal | null>(null)
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null)
  const [fundsAmount, setFundsAmount] = useState('')
  const [fundsLoading, setFundsLoading] = useState(false)

  const handleDelete = async () => {
    if (!deleteGoalItem) return
    try {
      await deleteGoal(deleteGoalItem._id)
      toast('Goal deleted', 'success')
      setDeleteGoalItem(null)
    } catch {
      toast('Failed to delete goal', 'error')
    }
  }

  const handleAddFunds = async () => {
    if (!addFundsGoal || !fundsAmount || isNaN(Number(fundsAmount))) return
    setFundsLoading(true)
    try {
      await addFunds(addFundsGoal._id, Number(fundsAmount))
      toast(`${formatAmount(Number(fundsAmount))} added to "${addFundsGoal.title}"`, 'success')
      setAddFundsGoal(null)
      setFundsAmount('')
    } catch {
      toast('Failed to add funds', 'error')
    } finally {
      setFundsLoading(false)
    }
  }

  const activeCount = goals.filter((g) => g.status === 'active').length

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
            {t('goal.title')}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {activeCount} {t('goal.active')}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
          <span className="hidden sm:inline">{t('goal.add')}</span>
        </Button>
      </div>

      {/* ── Free-tier cap banner ─────────────────────────────────────────────── */}
      {showCapBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          borderRadius: 12,
          backgroundColor: 'var(--color-sage)',
          border: '1px solid var(--color-accent)',
        }}>
          <Lock style={{ width: 16, height: 16, color: 'var(--color-accent)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--color-accent)', flex: 1, lineHeight: 1.5 }}>
            You&apos;ve reached the free plan limit of 3 active goals.{' '}
            <strong>Upgrade to Premium</strong> to track unlimited goals.
          </p>
          <button
            onClick={() => setShowCapBanner(false)}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', color: 'var(--color-accent)', lineHeight: 1,
              padding: 0, flexShrink: 0,
            }}
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
      ) : goals.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-card)',
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          padding: '64px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            {t('goal.createFirst')}
          </p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus style={{ width: 14, height: 14, marginRight: 6 }} />
            {t('goal.create')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 16 }}>
          {goals.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              formatAmount={formatAmount}
              t={t}
              onEdit={() => setEditGoal(goal)}
              onDelete={() => setDeleteGoalItem(goal)}
              onAddFunds={() => setAddFundsGoal(goal)}
            />
          ))}
        </div>
      )}

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('goal.create')}>
        <GoalForm
          onSuccess={() => { setAddOpen(false); refetch() }}
          onCancel={() => setAddOpen(false)}
          onCapHit={() => setShowCapBanner(true)}
        />
      </Modal>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editGoal} onClose={() => setEditGoal(null)} title={t('goal.editTitle')}>
        {editGoal && (
          <GoalForm
            goal={editGoal}
            onSuccess={() => { setEditGoal(null); refetch() }}
            onCancel={() => setEditGoal(null)}
          />
        )}
      </Modal>

      {/* ── Add funds modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!addFundsGoal}
        onClose={() => { setAddFundsGoal(null); setFundsAmount('') }}
        title={`${t('goal.addFundsTitle')} "${addFundsGoal?.title}"`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {t('goal.addFundsCurrent')}:{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatAmount(addFundsGoal?.savedAmount ?? 0)}
            </strong>
            {' / '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatAmount(addFundsGoal?.targetAmount ?? 0)}
            </strong>
          </p>
          <Input
            label={t('goal.addFundsLabel')}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={fundsAmount}
            onChange={(e) => setFundsAmount(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="outline"
              style={{ flex: 1 }}
              onClick={() => { setAddFundsGoal(null); setFundsAmount('') }}
            >
              {t('common.cancel')}
            </Button>
            <Button style={{ flex: 1 }} loading={fundsLoading} onClick={handleAddFunds}>
              {t('goal.addFunds')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      <Modal open={!!deleteGoalItem} onClose={() => setDeleteGoalItem(null)} title={t('goal.deleteTitle')}>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          {t('goal.deleteConfirm')}{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>&quot;{deleteGoalItem?.title}&quot;</strong>?{' '}
          {t('goal.deleteConfirm2')}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={() => setDeleteGoalItem(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" style={{ flex: 1 }} onClick={handleDelete}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
