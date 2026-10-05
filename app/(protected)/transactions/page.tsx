'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { format } from 'date-fns'
import { Plus, Download, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useTransactions, Transaction } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences } from '@/hooks/usePreferences'
import { useViewCurrency } from '@/context/ViewCurrencyContext'
import ViewCurrencySwitcher from '@/components/ViewCurrencySwitcher'
import { useLanguage } from '@/context/LanguageContext'
import { useToast } from '@/components/ui/Toast'
import { useSession } from 'next-auth/react'
import { isPremium } from '@/lib/tier'
import ImportModal from '@/components/import/ImportModal'
import AccountStrip from '@/components/accounts/AccountStrip'
import TransactionForm from './TransactionForm'
import BulkTransactionForm from './BulkTransactionForm'
import BulkAddSheet from './BulkAddSheet'
import TransactionFilters, { NO_FILTERS, type TransactionFilterValues } from './TransactionFilters'
import { MobileTransactionList, TransactionTable } from './TransactionList'
import Pagination from './Pagination'
import { onTransactionSaved } from '@/lib/transactionEvents'

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
  const { viewCurrency, isMultiCurrency } = useViewCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { data: session } = useSession()

  const { accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const accountNameById = new Map(accounts.map((a) => [a._id, a.name]))

  const { preferences, update: updatePreferences } = usePreferences()
  const hiddenAccountIds = preferences?.transactionsHiddenAccountIds ?? []
  const stripCollapsed = preferences?.transactionsAccountStripCollapsed ?? false

  const searchParams = useSearchParams()

  const [page, setPage] = useState(1)
  const isMobile = useMediaQuery('(max-width: 639px)')
  // Below `lg` - matches the breakpoint the mobile day-grouped list already switches on -
  // so the bulk sheet only replaces the modal where the row layout is mobile-shaped.
  const isBelowLg = useMediaQuery('(max-width: 1023px)')
  const [filters, setFilters] = useState<TransactionFilterValues>(() => ({
    ...NO_FILTERS,
    search: searchParams.get('search') ?? '',
  }))
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null)

  // Any filter change goes back to page 1
  const updateFilters = (patch: Partial<TransactionFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  // Multi-currency users see one currency at a time. A selected account already pins the
  // currency, so its own currency wins over the switcher (never an empty list).
  const selectedAccount = accounts.find((a) => a._id === filters.account)
  const listCurrency = selectedAccount?.currency ?? viewCurrency

  // Switching currency goes back to page 1 (adjusted during render, not in an effect)
  const [prevViewCurrency, setPrevViewCurrency] = useState(viewCurrency)
  if (viewCurrency !== prevViewCurrency) {
    setPrevViewCurrency(viewCurrency)
    setPage(1)
  }

  const userIsPremium = session
    ? isPremium({ tier: session.user.tier, premiumOverride: session.user.premiumOverride })
    : false

  const { transactions, total, totalPages, loading, deleteTransaction, refetch } = useTransactions({
    type: filters.type === 'all' ? '' : filters.type,
    accountId: filters.account === 'all' ? '' : filters.account,
    currency: isMultiCurrency ? listCurrency : undefined,
    search: filters.search,
    startDate: filters.startDate,
    endDate: filters.endDate,
    page,
    limit: 15,
  })

  // Refresh the list when the mobile quick-add sheet saves a transaction
  useEffect(() => onTransactionSaved(() => {
    refetch()
    refetchAccounts()
  }), [refetch, refetchAccounts])

  const handleDelete = async () => {
    if (!deleteTx) return
    try {
      await deleteTransaction(deleteTx._id)
      refetchAccounts()
      toast(t('tx.deletedToast'), 'success')
      setDeleteTx(null)
    } catch {
      toast(t('tx.deleteFailedToast'), 'error')
    }
  }

  const exportCSV = () => {
    const headers = [`Date,Type,Category,Description,Amount (${listCurrency}),Tags`]
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

  const listProps = { transactions, loading, accountNameById, onEdit: setEditTx, onDelete: setDeleteTx }

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
          {!selectedAccount && <ViewCurrencySwitcher />}
        </div>

        {/* Button row - Add is hidden on mobile since the FAB covers it; full width so remaining buttons are always visible */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Download className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{t('tx.exportLabel')}</span>
            <span className="sm:hidden">{t('tx.exportLabel')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Upload className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{t('tx.import')}</span>
            <span className="sm:hidden">{t('tx.import')}</span>
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)} className="h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs flex-1 sm:flex-none">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">{t('bulk.title')}</span>
            <span className="sm:hidden">{t('tx.bulkShort')}</span>
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="hidden sm:inline-flex h-9 px-3 text-xs sm:h-8 sm:px-3 sm:text-xs sm:flex-none">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{t('common.add')}</span>
          </Button>
        </div>
      </div>

      {/* ── Account balance strip ────────────────────────────────────────────── */}
      <AccountStrip
        accounts={accounts.filter((a) => !a.isArchived)}
        accountsLoading={accountsLoading}
        accountsError={accountsError}
        onRetry={refetchAccounts}
        activeAccountId={filters.account === 'all' || filters.account === 'unassigned' ? '' : filters.account}
        onSelectAccount={(id) => updateFilters({ account: filters.account === id ? 'all' : id })}
        hiddenAccountIds={hiddenAccountIds}
        onChangeHiddenAccountIds={(ids) => updatePreferences({ transactionsHiddenAccountIds: ids })}
        collapsed={stripCollapsed}
        onToggleCollapsed={() => updatePreferences({ transactionsAccountStripCollapsed: !stripCollapsed })}
      />

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <TransactionFilters
        filters={filters}
        accounts={accounts}
        onChange={updateFilters}
        onClear={() => updateFilters(NO_FILTERS)}
      />

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

        {/* Day-grouped rows - mobile (no table/columns at phone widths) */}
        <div className="lg:hidden" style={{ padding: '4px 20px' }}>
          <MobileTransactionList {...listProps} />
        </div>

        <div className="hidden lg:block" style={{ overflowX: 'auto' }}>
          <TransactionTable {...listProps} />
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} compact={isMobile} />
      </div>

      {/* ── Import modal ─────────────────────────────────────────────────────── */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { refetch(); refetchAccounts() }}
        isPremium={userIsPremium}
      />

      {/* ── Add modal ────────────────────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('tx.add')}>
        <TransactionForm
          onSuccess={() => { setAddOpen(false); refetch(); refetchAccounts() }}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      {/* ── Bulk add ─────────────────────────────────────────────────────────── */}
      {isBelowLg ? (
        <BulkAddSheet
          open={bulkOpen}
          onSuccess={() => { setBulkOpen(false); refetch(); refetchAccounts() }}
          onCancel={() => setBulkOpen(false)}
        />
      ) : (
        <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title={t('bulk.titleFull')}>
          <BulkTransactionForm
            onSuccess={() => { setBulkOpen(false); refetch(); refetchAccounts() }}
            onCancel={() => setBulkOpen(false)}
          />
        </Modal>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title={t('tx.editTitle')}>
        {editTx && (
          <TransactionForm
            transaction={editTx}
            onSuccess={() => { setEditTx(null); refetch(); refetchAccounts() }}
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
