'use client'

import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import Select from '@/components/ui/Select'
import { useLanguage } from '@/context/LanguageContext'
import type { Account } from '@/hooks/useAccounts'

export interface TransactionFilterValues {
  /** 'all' or a transaction type */
  type: string
  /** 'all', 'unassigned', or an account id */
  account: string
  search: string
  startDate: string
  endDate: string
}

export const NO_FILTERS: TransactionFilterValues = {
  type: 'all', account: 'all', search: '', startDate: '', endDate: '',
}

interface TransactionFiltersProps {
  filters: TransactionFilterValues
  accounts: Account[]
  onChange: (patch: Partial<TransactionFilterValues>) => void
  onClear: () => void
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-card)',
  borderRadius: 16,
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
}

const dateInputStyle: React.CSSProperties = {
  height: 40, padding: '0 12px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-elevated)',
  color: 'var(--color-text-primary)',
  fontSize: '0.82rem',
  outline: 'none',
}

const dateLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function TransactionFilters({ filters, accounts, onChange, onClear }: TransactionFiltersProps) {
  const { t } = useLanguage()
  // What's typed in the search box - applied to `filters.search` on Enter
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showDateFilters, setShowDateFilters] = useState(false)

  const typeOptions = [
    { value: 'all',      label: t('tx.allTypes') },
    { value: 'income',   label: t('common.income') },
    { value: 'expense',  label: t('common.expense') },
    { value: 'savings',  label: t('common.savings') },
    { value: 'transfer', label: t('common.transfer') },
  ]

  const accountOptions = [
    { value: 'all', label: t('tx.allAccounts') },
    { value: 'unassigned', label: t('common.unassigned') },
    ...accounts.filter((a) => !a.isArchived).map((a) => ({ value: a._id, label: a.name })),
  ]

  const anyActive = Boolean(
    searchInput || filters.search || filters.type !== 'all' || filters.account !== 'all' || filters.startDate || filters.endDate,
  )

  const clearAll = () => {
    setSearchInput('')
    onClear()
  }

  return (
    <div style={cardStyle}>
      <div
        className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end"
        style={{ padding: '14px 16px' }}
      >

        {/* Search */}
        <div className="w-full sm:flex-1 sm:min-w-0" style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 15, height: 15, color: 'var(--color-text-muted)', pointerEvents: 'none',
          }} />
          <input
            style={{
              height: 40, width: '100%',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-elevated)',
              color: 'var(--color-text-primary)',
              fontSize: '0.85rem',
              paddingLeft: 38, paddingRight: 36,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            placeholder={t('tx.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onChange({ search: searchInput })
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          />
          {anyActive && (
            <button
              onClick={clearAll}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%',
                border: 'none', backgroundColor: 'var(--color-text-muted)',
                cursor: 'pointer', padding: 0,
                opacity: 0.7,
              }}
              title={t('tx.clearAllFiltersTooltip')}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
            >
              <X style={{ width: 11, height: 11, color: 'var(--color-card)' }} />
            </button>
          )}
        </div>

        {/* Type + Account selects - paired on mobile so they share a row */}
        <div className="grid grid-cols-2 gap-2.5 w-full sm:contents">
          <div className="sm:w-[148px] sm:flex-shrink-0">
            <Select
              value={filters.type}
              onValueChange={(v) => onChange({ type: v })}
              options={typeOptions}
              placeholder={t('common.type')}
            />
          </div>

          <div className="sm:w-[160px] sm:flex-shrink-0">
            <Select
              value={filters.account}
              onValueChange={(v) => onChange({ account: v })}
              options={accountOptions}
              placeholder={t('quickAdd.account')}
            />
          </div>
        </div>

        {/* Date filter toggle */}
        <button
          onClick={() => setShowDateFilters((v) => !v)}
          className="w-full sm:w-auto"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 40, padding: '0 14px',
            borderRadius: 10,
            border: showDateFilters ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
            backgroundColor: showDateFilters ? 'var(--color-sage)' : 'var(--color-elevated)',
            color: showDateFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          <Filter style={{ width: 14, height: 14 }} />
          <span>
            {showDateFilters ? t('tx.hideFilter') : t('tx.dateFilter')}
          </span>
        </button>
      </div>

      {/* Date range row */}
      {showDateFilters && (
        <div
          className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end"
          style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div className="w-full sm:w-auto" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={dateLabelStyle}>{t('tx.dateFrom')}</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full sm:w-auto"
              style={dateInputStyle}
            />
          </div>
          <div className="w-full sm:w-auto" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={dateLabelStyle}>{t('tx.dateTo')}</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className="w-full sm:w-auto"
              style={dateInputStyle}
            />
          </div>
          <button
            onClick={clearAll}
            className="w-full sm:w-auto"
            style={{
              height: 40, padding: '0 14px',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {t('tx.clearFilters')}
          </button>
        </div>
      )}
    </div>
  )
}
