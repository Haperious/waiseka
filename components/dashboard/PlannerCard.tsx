'use client'

import { useCallback, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarRange, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { useResource } from '@/hooks/useFetch'
import { formatAmount } from '@/lib/currency'
import { formatDay, localToday } from '@/lib/planner/days'
import { onTransactionSaved } from '@/lib/transactionEvents'
import type { PlannerSummary } from '@/lib/planner/types'

/**
 * Dashboard strip: where the most recently edited Planner plan says the balance lands.
 * With no plan yet, it's a one-line invitation to make one. Never blocks the dashboard -
 * a failed fetch just shows the invitation.
 */
export default function PlannerCard() {
  const { t } = useLanguage()
  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/planner/summary?today=${localToday()}`)
    return res.ok ? ((await res.json()) as PlannerSummary | null) : null
  }, [])
  const { data, loading, refetch } = useResource(fetcher)
  useEffect(() => onTransactionSaved(() => void refetch()), [refetch])

  const shell: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 16,
    backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', textDecoration: 'none',
  }

  if (loading && data === undefined) {
    return (
      <div style={shell}>
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  const today = localToday()
  const icon = (
    <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-sage)', color: 'var(--color-accent)' }}>
      <CalendarRange size={17} />
    </span>
  )

  if (!data) {
    return (
      <Link href="/planner" style={shell} data-testid="planner-card">
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{t('planner.cardEmptyTitle')}</p>
          <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('planner.cardEmptyBody')}</p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      </Link>
    )
  }

  const fmt = (n: number) => formatAmount(n, data.currency)
  const negative = data.firstNegativeDay !== null
  return (
    <Link href={`/planner?id=${data.id}`} style={shell} data-testid="planner-card">
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.expired
            ? t('planner.planEnded').replace('{date}', formatDay(data.endDate, today))
            : t('planner.projectedOn').replace('{date}', formatDay(data.endDate, today))}
          {' · '}{data.name}
        </p>
        <p style={{ fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: data.end < 0 ? 'var(--color-expense)' : 'var(--color-text-primary)', marginTop: 2 }}>
          {fmt(data.end)}
        </p>
        {negative ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: 'var(--color-expense)', marginTop: 2 }}>
            <AlertTriangle size={12} />
            {t('planner.cardNegative').replace('{date}', formatDay(data.firstNegativeDay!, today))}
          </p>
        ) : data.overdueCount > 0 ? (
          <p style={{ fontSize: '0.74rem', color: 'var(--color-warning)', marginTop: 2 }}>
            {data.overdueCount === 1 ? t('planner.cardOverdueOne') : t('planner.cardOverdue').replace('{n}', String(data.overdueCount))}
          </p>
        ) : !data.expired ? (
          <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {t('planner.lowestPoint').replace('{low}', fmt(data.lowest.balance)).replace('{date}', formatDay(data.lowest.day, today))}
          </p>
        ) : null}
      </div>
      <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
    </Link>
  )
}
