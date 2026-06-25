'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Plus, TrendingUp, TrendingDown, PiggyBank,
  Pencil, Trash2, Download, Search, Filter, Upload, RefreshCw, X,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { useTransactions, Transaction } from '@/hooks/useTransactions'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { useToast } from '@/components/ui/Toast'
import { useSession } from 'next-auth/react'
import { isPremium } from '@/lib/tier'
import ImportModal from '@/components/import/ImportModal'
import TransactionForm from './TransactionForm'
import BulkTransactionForm from './BulkTransactionForm'

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-card)',
  borderRadius: 16,
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderBottom: '1px solid var(--color-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

export default function TransactionsPage() {
  const { formatAmount, currency } = useCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { data: session } = useSession()

  const [page, setPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const userIsPremium = session
    ? isPremium({ tier: session.user.tier, premiumOverride: session.user.premiumOverride })
    : false

  const TYPE_OPTIONS = [
    { value: 'all',     label: t('tx.allTypes') },
    { value: 'income',  label: t('common.income') },
    { value: 'expense', label: t('common.expense') },
    { value: 'savings', label: t('common.savings') },
  ]

  const { transactions, total, totalPages, loading, deleteTransaction, refetch } = useTransactions({
    type: filterType === 'all' ? '' : filterType,
    search,
    startDate,
    endDate,
    page,
    limit: 15,
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleDelete = async () => {
    if (!deleteTx) return
    try {
      await deleteTransaction(deleteTx._id)
      toast('Transaction deleted', 'success')
      setDeleteTx(null)
    } catch {
      toast('Failed to delete transaction', 'error')
    }
  }

  const exportCSV = () => {
    const headers = [`Date,Type,Category,Description,Amount (${currency}),Tags`]
    const rows = transactions.map((tx) =>
      [
        format(new Date(tx.date), 'yyyy-MM-dd'),
        tx.type,
        tx.category,
        `"${tx.description ?? ''}"`,
        tx.amount.toFixed(2),
        `"${tx.tags.join('; ')}"`,
      ].join(',')
    )
    const csv = [...headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Type badge ────────────────────────────────────────────────────────────
  function TypeBadge({ type }: { type: string }) {
    const config =
      type === 'income'
        ? { color: 'var(--color-income)', bg: 'var(--color-income-bg)', Icon: TrendingUp, label: t('common.income') }
        : type === 'savings'
        ? { color: 'var(--color-savings)', bg: 'var(--color-savings-bg)', Icon: PiggyBank, label: t('common.savings') }
        : { color: 'var(--color-expense)', bg: 'var(--color-expense-bg)', Icon: TrendingDown, label: t('common.expense') }

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
    const color =
      tx.type === 'income' ? 'var(--color-income)' :
      tx.type === 'savings' ? 'var(--color-savings)' :
      'var(--color-expense)'
    const prefix = tx.type === 'income' ? '+' : tx.type === 'savings' ? '=' : '−'

    return (
      <span style={{
        color,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        fontSize: '0.9rem',
        whiteSpace: 'nowrap',
      }}>
        {prefix}{formatAmount(tx.amount)}
      </span>
    )
  }

  // ── Pagination helpers ────────────────────────────────────────────────────
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

  function Ellipsis() {
    return (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: '32px' }}>
        …
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h1 style={{
              fontSize: '1.6rem', fontWeight: 900,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-playfair), Georgia, serif',
              lineHeight: 1.1,
            }}>
              {t('tx.title')}
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              {total} {t('tx.totalRecords')}
            </p>
          </div>
        </div>

        {/* Button row — full width on mobile so all 4 buttons are always visible */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Download className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{t('tx.exportLabel')}</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Upload className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{t('tx.import')}</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Add Multiple</span>
            <span className="sm:hidden">Bulk</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{t('common.add')}</span>
          </Button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>

          {/* Search */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
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
                if (e.key === 'Enter') { setSearch(searchInput); setPage(1) }
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            />
            {(searchInput || search || filterType !== 'all' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setFilterType('all')
                  setStartDate('')
                  setEndDate('')
                  setPage(1)
                }}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: '50%',
                  border: 'none', backgroundColor: 'var(--color-text-muted)',
                  cursor: 'pointer', padding: 0,
                  opacity: 0.7,
                }}
                title="Clear all filters"
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
              >
                <X style={{ width: 11, height: 11, color: 'var(--color-card)' }} />
              </button>
            )}
          </div>

          {/* Type select */}
          <div style={{ width: 148, flexShrink: 0 }}>
            <Select
              value={filterType}
              onValueChange={(v) => { setFilterType(v); setPage(1) }}
              options={TYPE_OPTIONS}
              placeholder={t('common.type')}
            />
          </div>

          {/* Date filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 40, padding: '0 14px',
              borderRadius: 10,
              border: showFilters ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              backgroundColor: showFilters ? 'var(--color-sage)' : 'var(--color-elevated)',
              color: showFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <Filter style={{ width: 14, height: 14 }} />
            <span className="hidden sm:inline">
              {showFilters ? t('tx.hideFilter') : t('tx.dateFilter')}
            </span>
          </button>
        </div>

        {/* Date range row */}
        {showFilters && (
          <div style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('tx.dateFrom')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                style={{
                  height: 38, padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('tx.dateTo')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                style={{
                  height: 38, padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setFilterType('all')
                setSearch('')
                setSearchInput('')
                setPage(1)
              }}
              style={{
                height: 38, padding: '0 14px',
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

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ ...sectionHeaderStyle }}>
          <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {t('tx.title')}
          </h2>
          {!loading && total > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {total} {t('tx.totalRecords')}
            </span>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {[
                  { label: t('common.date'),        className: '' },
                  { label: t('common.description'), className: '' },
                    { label: 'Recurring',             className: 'hidden sm:table-cell' },
                  { label: t('common.category'),    className: 'hidden sm:table-cell' },
                  { label: t('common.type'),        className: 'hidden md:table-cell' },
                  { label: t('common.amount'),      className: '', align: 'right' as const },
                  { label: '',                      className: '' },
                ].map(({ label, className, align }, i) => (
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
                    <td colSpan={7} style={{ padding: '0 20px' }}>
                      <SkeletonRow />
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
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
                          title="Recurring"
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
                          Recurring
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="hidden sm:table-cell" style={{ padding: '12px 20px', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                      {tx.category}
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
                        <button
                          onClick={() => setEditTx(tx)}
                          aria-label={t('common.edit')}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8,
                            border: 'none', backgroundColor: 'transparent',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
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
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          onClick={() => setDeleteTx(tx)}
                          aria-label={t('common.delete')}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8,
                            border: 'none', backgroundColor: 'transparent',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
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
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            flexWrap: 'nowrap',
          }}>
            {/* Previous */}
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                height: 32,
                padding: isMobile ? '0 10px' : '0 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: page <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                fontSize: '0.8rem', fontWeight: 500, cursor: page <= 1 ? 'default' : 'pointer',
                opacity: page <= 1 ? 0.45 : 1,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {isMobile ? '←' : t('tx.previous')}
            </button>

            {/* Page number buttons */}
            {(() => {
              const buttons: React.ReactNode[] = []

              if (isMobile) {
                // Mobile: always show first | … | current | … | last
                if (page === 1) {
                  // On first page: just show 1 (active) … last
                  buttons.push(<PageBtn key={1} n={1} current={page} onClick={setPage} />)
                  if (totalPages > 2) buttons.push(<Ellipsis key="e1" />)
                  if (totalPages > 1) buttons.push(<PageBtn key={totalPages} n={totalPages} current={page} onClick={setPage} />)
                } else if (page === totalPages) {
                  // On last page: first … last (active)
                  buttons.push(<PageBtn key={1} n={1} current={page} onClick={setPage} />)
                  if (totalPages > 2) buttons.push(<Ellipsis key="e1" />)
                  buttons.push(<PageBtn key={totalPages} n={totalPages} current={page} onClick={setPage} />)
                } else {
                  // Middle page: first … current … last
                  buttons.push(<PageBtn key={1} n={1} current={page} onClick={setPage} />)
                  if (page > 2) buttons.push(<Ellipsis key="e1" />)
                  if (page !== 1) buttons.push(<PageBtn key={page} n={page} current={page} onClick={setPage} />)
                  if (page < totalPages - 1) buttons.push(<Ellipsis key="e2" />)
                  buttons.push(<PageBtn key={totalPages} n={totalPages} current={page} onClick={setPage} />)
                }
              } else {
                // Desktop: delta = 2, show up to 5 pages around current
                const delta = 2
                let start = Math.max(1, page - delta)
                let end   = Math.min(totalPages, page + delta)

                if (end - start < delta * 2) {
                  if (start === 1) end   = Math.min(totalPages, start + delta * 2)
                  else             start = Math.max(1, end - delta * 2)
                }

                if (start > 1) {
                  buttons.push(<PageBtn key={1} n={1} current={page} onClick={setPage} />)
                  if (start > 2) buttons.push(<Ellipsis key="e1" />)
                }

                for (let n = start; n <= end; n++) {
                  buttons.push(<PageBtn key={n} n={n} current={page} onClick={setPage} />)
                }

                if (end < totalPages) {
                  if (end < totalPages - 1) buttons.push(<Ellipsis key="e2" />)
                  buttons.push(<PageBtn key={totalPages} n={totalPages} current={page} onClick={setPage} />)
                }
              }

              return buttons
            })()}

            {/* Next */}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                height: 32,
                padding: isMobile ? '0 10px' : '0 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: page >= totalPages ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                fontSize: '0.8rem', fontWeight: 500, cursor: page >= totalPages ? 'default' : 'pointer',
                opacity: page >= totalPages ? 0.45 : 1,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {isMobile ? '→' : t('tx.next')}
            </button>
          </div>
        )}
      </div>

      {/* ── Import modal ─────────────────────────────────────────────────────── */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetch}
        isPremium={userIsPremium}
      />

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('tx.add')}>
        <TransactionForm
          onSuccess={() => { setAddOpen(false); refetch() }}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      {/* ── Bulk add modal ───────────────────────────────────────────────────── */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Add Multiple Transactions">
        <BulkTransactionForm
          onSuccess={() => { setBulkOpen(false); refetch() }}
          onCancel={() => setBulkOpen(false)}
        />
      </Modal>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title={t('tx.editTitle')}>
        {editTx && (
          <TransactionForm
            transaction={editTx}
            onSuccess={() => { setEditTx(null); refetch() }}
            onCancel={() => setEditTx(null)}
          />
        )}
      </Modal>

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title={t('tx.deleteTitle')}>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          {t('tx.deleteConfirm')} {t('tx.deleteWarning')}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={() => setDeleteTx(null)}>
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
