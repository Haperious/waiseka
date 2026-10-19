'use client'

import { useLanguage } from '@/context/LanguageContext'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  /** Phone layout: arrow-only prev/next and first … current … last. */
  compact: boolean
}

type PageItem = number | 'gap'

/**
 * Which page buttons to show. Compact: first … current … last. Otherwise up to 5
 * pages around the current one (delta 2), plus first/last with gaps as needed.
 */
function pageItems(page: number, totalPages: number, compact: boolean): PageItem[] {
  const items: PageItem[] = []

  if (compact) {
    items.push(1)
    if (page === 1 || page === totalPages) {
      if (totalPages > 2) items.push('gap')
    } else {
      if (page > 2) items.push('gap')
      items.push(page)
      if (page < totalPages - 1) items.push('gap')
    }
    if (totalPages > 1) items.push(totalPages)
    return items
  }

  const delta = 2
  let start = Math.max(1, page - delta)
  let end = Math.min(totalPages, page + delta)
  if (end - start < delta * 2) {
    if (start === 1) end = Math.min(totalPages, start + delta * 2)
    else start = Math.max(1, end - delta * 2)
  }

  if (start > 1) {
    items.push(1)
    if (start > 2) items.push('gap')
  }
  for (let n = start; n <= end; n++) items.push(n)
  if (end < totalPages) {
    if (end < totalPages - 1) items.push('gap')
    items.push(totalPages)
  }
  return items
}

function PageBtn({ n, current, onClick }: { n: number; current: number; onClick: (n: number) => void }) {
  const isActive = n === current
  return (
    <button
      onClick={() => onClick(n)}
      style={{
        width: 32, height: 32,
        borderRadius: 8,
        border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        backgroundColor: isActive ? 'var(--color-sage)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {n}
    </button>
  )
}

function stepButtonStyle(disabled: boolean, compact: boolean): React.CSSProperties {
  return {
    height: 32,
    padding: compact ? '0 10px' : '0 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    backgroundColor: 'transparent',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    fontSize: '0.8rem', fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
  }
}

export default function Pagination({ page, totalPages, onChange, compact }: PaginationProps) {
  const { t } = useLanguage()
  if (totalPages <= 1) return null

  return (
    <div style={{
      padding: '14px 24px',
      borderTop: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      flexWrap: 'nowrap',
    }}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} style={stepButtonStyle(page <= 1, compact)}>
        {compact ? '←' : t('tx.previous')}
      </button>

      {pageItems(page, totalPages, compact).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: '32px' }}>
            …
          </span>
        ) : (
          <PageBtn key={item} n={item} current={page} onClick={onChange} />
        ),
      )}

      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} style={stepButtonStyle(page >= totalPages, compact)}>
        {compact ? '→' : t('tx.next')}
      </button>
    </div>
  )
}
