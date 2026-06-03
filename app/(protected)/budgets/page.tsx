'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useBudgets, Budget } from '@/hooks/useBudgets'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { TranslationKey } from '@/lib/translations'
import { useToast } from '@/components/ui/Toast'
import BudgetForm from './BudgetForm'

// ── Animated progress bar ────────────────────────────────────────────────────
function BudgetProgressBar({ spent, limit }: { spent: number; limit: number }) {
  const percent = Math.min((spent / limit) * 100, 100)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  const barColor =
    percent >= 90 ? 'var(--color-expense)' :
    percent >= 70 ? 'var(--color-warning)' :
    'var(--color-income)'

  const trackColor =
    percent >= 90 ? 'var(--color-expense-bg)' :
    percent >= 70 ? 'var(--color-warning-bg)' :
    'var(--color-income-bg)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        height: 6, width: '100%',
        borderRadius: 999,
        backgroundColor: 'var(--color-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: animated ? `${percent}%` : '0%',
          borderRadius: 999,
          backgroundColor: barColor,
          transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: barColor,
        }}>
          {Math.round(percent)}%
        </span>
        {percent >= 90 && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700,
            color: 'var(--color-expense)',
            padding: '1px 8px', borderRadius: 999,
            backgroundColor: 'var(--color-expense-bg)',
          }}>
            Over budget!
          </span>
        )}
      </div>
    </div>
  )
}

// ── Budget card ──────────────────────────────────────────────────────────────
function BudgetCard({
  budget,
  formatAmount,
  t,
  onEdit,
  onDelete,
}: {
  budget: Budget
  formatAmount: (v: number) => string
  t: (key: TranslationKey) => string
  onEdit: () => void
  onDelete: () => void
}) {
  const percent = Math.min((budget.spent / budget.limit) * 100, 100)
  const accentColor = budget.color ?? '#16a34a'

  const spentColor =
    percent >= 90 ? 'var(--color-expense)' :
    'var(--color-text-primary)'

  const remainingColor =
    budget.limit - budget.spent < 0 ? 'var(--color-expense)' : 'var(--color-income)'

  return (
    <div style={{
      backgroundColor: 'var(--color-card)',
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      borderTop: `3px solid ${accentColor}`,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header: category + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Color dot container */}
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: `${accentColor}18`,
            border: `1.5px solid ${accentColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              backgroundColor: accentColor,
            }} />
          </div>

          <div>
            <p style={{
              fontWeight: 700, fontSize: '0.9rem',
              color: 'var(--color-text-primary)', lineHeight: 1.2,
            }}>
              {budget.category}
            </p>
            <span style={{
              fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'capitalize',
              letterSpacing: '0.03em',
            }}>
              {budget.period}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
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

      {/* Progress bar */}
      <BudgetProgressBar spent={budget.spent} limit={budget.limit} />

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: t('budget.spent'),     value: formatAmount(budget.spent),                         color: spentColor },
          { label: t('budget.limit'),     value: formatAmount(budget.limit),                         color: 'var(--color-text-primary)' },
          { label: t('budget.remaining'), value: formatAmount(Math.max(budget.limit - budget.spent, 0)), color: remainingColor },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </p>
            <p style={{ fontSize: '1rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BudgetsPage() {
  const { formatAmount } = useCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { budgets, loading, deleteBudget, refetch } = useBudgets()

  const [addOpen, setAddOpen] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | null>(null)
  const [deleteBudgetItem, setDeleteBudgetItem] = useState<Budget | null>(null)
  const [showCapBanner, setShowCapBanner] = useState(false)

  const handleDelete = async () => {
    if (!deleteBudgetItem) return
    try {
      await deleteBudget(deleteBudgetItem._id)
      toast('Budget deleted', 'success')
      setDeleteBudgetItem(null)
    } catch {
      toast('Failed to delete budget', 'error')
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
            {t('budget.title')}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {budgets.length} {t('budget.title').toLowerCase()} {t('budget.active')}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
          <span className="hidden sm:inline">{t('budget.add')}</span>
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
            You&apos;ve reached the free plan limit of 3 budgets.{' '}
            <strong>Upgrade to Premium</strong> to create unlimited budgets.
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : budgets.length === 0 ? (
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
            {t('budget.createFirst')}
          </p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus style={{ width: 14, height: 14, marginRight: 6 }} />
            {t('budget.create')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {budgets.map((b) => (
            <BudgetCard
              key={b._id}
              budget={b}
              formatAmount={formatAmount}
              t={t}
              onEdit={() => setEditBudget(b)}
              onDelete={() => setDeleteBudgetItem(b)}
            />
          ))}
        </div>
      )}

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('budget.create')}>
        <BudgetForm
          onSuccess={() => { setAddOpen(false); refetch() }}
          onCancel={() => setAddOpen(false)}
          onCapHit={() => setShowCapBanner(true)}
        />
      </Modal>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editBudget} onClose={() => setEditBudget(null)} title={t('budget.editTitle')}>
        {editBudget && (
          <BudgetForm
            budget={editBudget}
            onSuccess={() => { setEditBudget(null); refetch() }}
            onCancel={() => setEditBudget(null)}
          />
        )}
      </Modal>

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      <Modal open={!!deleteBudgetItem} onClose={() => setDeleteBudgetItem(null)} title={t('budget.deleteTitle')}>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          {t('budget.deleteConfirm')}{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>&quot;{deleteBudgetItem?.category}&quot;</strong>{' '}
          {t('budget.deleteConfirm2')}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={() => setDeleteBudgetItem(null)}>
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
