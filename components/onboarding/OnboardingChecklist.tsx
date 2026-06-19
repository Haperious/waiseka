'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderPlus,
  Target,
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OnboardingStepId } from '@/lib/models/User'

// ── Step definitions ────────────────────────────────────────────────────────

interface OnboardingStep {
  id: OnboardingStepId
  label: string
  description: string
  href: string
  // The route(s) that count as "visiting" this step
  matchPaths: string[]
  icon: React.ElementType
}

const STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    label: 'Explore your Dashboard',
    description: 'Get an overview of your income, expenses, and savings.',
    href: '/dashboard',
    matchPaths: ['/dashboard'],
    icon: LayoutDashboard,
  },
  {
    id: 'transactions',
    label: 'Add a Transaction',
    description: 'Log your first income or expense entry.',
    href: '/transactions',
    matchPaths: ['/transactions'],
    icon: ArrowLeftRight,
  },
  {
    id: 'categories',
    label: 'Add a Category',
    description: 'Create a custom category to organise your spending.',
    href: '/categories',
    matchPaths: ['/categories'],
    icon: FolderPlus,
  },
  {
    id: 'goals',
    label: 'Create a Goal',
    description: 'Set a savings target and track your progress.',
    href: '/goals',
    matchPaths: ['/goals'],
    icon: Target,
  },
]

// ── Props ───────────────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  initialStepsCompleted: OnboardingStepId[]
  initialDismissed: boolean
  initialCompletedAt: Date | null
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingChecklist({
  initialStepsCompleted,
  initialDismissed,
  initialCompletedAt,
}: OnboardingChecklistProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [stepsCompleted, setStepsCompleted] = useState<Set<OnboardingStepId>>(
    new Set(initialStepsCompleted)
  )
  const [dismissed, setDismissed] = useState(initialDismissed)
  const [completedAt, setCompletedAt] = useState<Date | null>(initialCompletedAt ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const [allDoneVisible, setAllDoneVisible] = useState(false)

  // Track which steps we've already persisted to avoid duplicate PATCH calls
  const persistedSteps = useRef<Set<OnboardingStepId>>(new Set(initialStepsCompleted))

  // ── Route-based auto-check ─────────────────────────────────────────────

  const markStep = useCallback(
    async (stepId: OnboardingStepId) => {
      if (persistedSteps.current.has(stepId)) return
      persistedSteps.current.add(stepId)

      setStepsCompleted((prev) => {
        const next = new Set(prev)
        next.add(stepId)
        return next
      })

      try {
        await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepCompleted: stepId }),
        })
      } catch (err) {
        console.error('[onboarding] failed to persist step:', stepId, err)
      }
    },
    []
  )

  useEffect(() => {
    STEPS.forEach((step) => {
      if (step.matchPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
        markStep(step.id)
      }
    })
  }, [pathname, markStep])

  // ── All-done detection ────────────────────────────────────────────────

  useEffect(() => {
    if (completedAt) return
    const allDone = STEPS.every((s) => stepsCompleted.has(s.id))
    if (allDone) {
      setCompletedAt(new Date())
      setAllDoneVisible(true)
      // Auto-hide: first clear the celebration card, then unmount entirely
      setTimeout(() => {
        setAllDoneVisible(false)
        setDismissed(true)
      }, 4000)
    }
  }, [stepsCompleted, completedAt])

  // ── Dismiss ────────────────────────────────────────────────────────────

  const handleDismiss = useCallback(async () => {
    setDismissed(true)
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
    } catch (err) {
      console.error('[onboarding] failed to persist dismiss:', err)
    }
  }, [])

  // ── Render guard ───────────────────────────────────────────────────────

  if (dismissed && !allDoneVisible) return null

  const completedCount = stepsCompleted.size
  const totalCount = STEPS.length
  const progressPct = Math.round((completedCount / totalCount) * 100)

  // ── All-done celebration state ─────────────────────────────────────────

  if (allDoneVisible) {
    return (
      <div
        className={cn(
          // Desktop: fixed bottom-right panel
          'fixed bottom-6 right-6 z-50 w-80',
          // Mobile: sits just above BottomNav (56px height)
          'max-lg:bottom-16 max-lg:right-3 max-lg:left-3 max-lg:w-auto'
        )}
      >
        <div
          className="rounded-2xl p-5 shadow-xl border flex flex-col items-center gap-2 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-accent)',
          }}
        >
          <Sparkles className="h-8 w-8" style={{ color: 'var(--color-accent)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            You're all set!
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            You've completed the WaiseKa setup. Happy budgeting!
          </p>
        </div>
      </div>
    )
  }

  // ── Main checklist ─────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'fixed z-50 w-80 shadow-xl rounded-2xl border overflow-hidden',
        // Desktop: bottom-right
        'bottom-6 right-6',
        // Mobile: above BottomNav, full-width with side margins
        'max-lg:bottom-16 max-lg:right-3 max-lg:left-3 max-lg:w-auto'
      )}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            Get started
          </span>
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: 'var(--color-sage)',
              color: 'var(--color-accent)',
            }}
          >
            {completedCount}/{totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded-md hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Dismiss onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: 'var(--color-elevated)' }}
      >
        <div
          className="h-1 transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            backgroundColor: 'var(--color-accent)',
          }}
        />
      </div>

      {/* Steps list */}
      {!collapsed && (
        <ul className="py-2">
          {STEPS.map((step) => {
            const done = stepsCompleted.has(step.id)
            const Icon = step.icon

            return (
              <li key={step.id}>
                <button
                  onClick={() => router.push(step.href)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                    !done && 'hover:bg-[var(--color-elevated)]'
                  )}
                  disabled={done}
                >
                  {/* Check icon */}
                  <span className="mt-0.5 shrink-0">
                    {done ? (
                      <CheckCircle2
                        className="h-4 w-4"
                        style={{ color: 'var(--color-accent)' }}
                      />
                    ) : (
                      <Circle
                        className="h-4 w-4"
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    )}
                  </span>

                  {/* Step icon + text */}
                  <span className="flex items-start gap-2 min-w-0">
                    <Icon
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{
                        color: done ? 'var(--color-text-muted)' : 'var(--color-accent)',
                      }}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn('block text-xs font-medium leading-snug', done && 'line-through')}
                        style={{
                          color: done
                            ? 'var(--color-text-muted)'
                            : 'var(--color-text-primary)',
                        }}
                      >
                        {step.label}
                      </span>
                      {!done && (
                        <span
                          className="block text-[11px] leading-snug mt-0.5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {step.description}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Footer note for mobile — categories is in More → Sidebar */}
      {!collapsed && (
        <p
          className="lg:hidden px-4 pb-3 text-[10px] leading-tight"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Tip: Categories is under <strong>More</strong> in the bottom menu.
        </p>
      )}
    </div>
  )
}
