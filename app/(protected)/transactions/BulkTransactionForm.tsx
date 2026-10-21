'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { ChevronDown, PiggyBank, Plus, Repeat, Trash2, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useDefaultAccount } from '@/hooks/useDefaultAccount'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { accountIdForSubmit } from '@/lib/accountSelection'
import { getCurrencySymbol } from '@/lib/currency'
import { moneyLabel, sanitizeAmount } from '@/components/forms/FormParts'
import { orderCategoryChips } from '@/lib/categoryChips'
import { lineErrorMessage, type RowErrors } from '@/lib/bulkLineError'
import styles from '@/components/forms/forms.module.css'

const UNASSIGNED = ''

interface BulkTransactionFormProps {
  onSuccess: () => void
  onCancel: () => void
}

interface TransactionRow {
  id: string
  type: 'income' | 'expense' | 'savings'
  amount: string
  category: string
  description: string
  isRecurring: boolean
}


const TYPE_OPTIONS: { value: TransactionRow['type']; Icon: LucideIcon; color: string }[] = [
  { value: 'expense', Icon: TrendingDown, color: 'var(--color-expense)' },
  { value: 'income', Icon: TrendingUp, color: 'var(--color-income)' },
  { value: 'savings', Icon: PiggyBank, color: 'var(--color-savings)' },
]

function createEmptyRow(): TransactionRow {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    isRecurring: false,
  }
}

/** Desktop Add Multiple table. Render inside <Modal variant="form" className="max-w-[820px]">. */
export default function BulkTransactionForm({ onSuccess, onCancel }: BulkTransactionFormProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { currency: primaryCurrency } = useCurrency()

  const activeAccounts = accounts.filter((a) => !a.isArchived)
  // Unassigned stays available but last, so a real account is the easy pick
  const accountOptions = [
    ...activeAccounts.map((a) => ({ value: a._id, label: a.name })),
    { value: UNASSIGNED, label: t('common.unassigned') },
  ]

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  // null = not picked yet, so the batch falls back to the default account
  const [chosenAccountId, setAccountId] = useState<string | null>(null)
  const { defaultAccountId, ready: defaultReady } = useDefaultAccount()
  const accountId = chosenAccountId ?? defaultAccountId
  const accountPending = chosenAccountId === null && !defaultReady
  const currency = activeAccounts.find((a) => a._id === accountId)?.currency ?? primaryCurrency
  const [rows, setRows] = useState<TransactionRow[]>([createEmptyRow(), createEmptyRow()])
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({})
  const [loading, setLoading] = useState(false)

  // Row to focus (its amount cell) after "add line" renders it
  const focusRowId = useRef<string | null>(null)
  const amountRefs = useRef(new Map<string, HTMLInputElement>())
  useEffect(() => {
    if (!focusRowId.current) return
    amountRefs.current.get(focusRowId.current)?.focus()
    focusRowId.current = null
  }, [rows])

  const categoryOptionsFor = useCallback(
    (type: TransactionRow['type']) =>
      orderCategoryChips(categories.filter((c) => c.type === type || c.type === 'both' || type === 'savings'), ''),
    [categories]
  )

  const updateRow = useCallback((id: string, patch: Partial<TransactionRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, ...patch }
        if (patch.type && patch.type !== r.type) updated.category = ''
        return updated
      })
    )
    setRowErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev[id] }
      Object.keys(patch).forEach((k) => delete next[k])
      return { ...prev, [id]: next }
    })
  }, [])

  const addRow = useCallback(() => {
    const row = createEmptyRow()
    focusRowId.current = row.id
    setRows((prev) => [...prev, row])
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const validate = (): boolean => {
    const errors: Record<string, RowErrors> = {}
    for (const row of rows) {
      const e: RowErrors = {}
      if (!row.amount || isNaN(Number(row.amount)) || Number(row.amount) <= 0)
        e.amount = t('bulkForm.required')
      if (!row.category) e.category = t('bulkForm.required')
      if (Object.keys(e).length > 0) errors[row.id] = e
    }
    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!date) {
      toast(t('bulkForm.selectDate'), 'error')
      return
    }
    if (!validate()) {
      toast(t('bulkForm.fixFields'), 'error')
      return
    }
    setLoading(true)
    try {
      const transactions = rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount),
        category: r.category,
        description: r.description,
        date,
        isRecurring: r.isRecurring,
      }))

      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, accountId: accountIdForSubmit(chosenAccountId, defaultAccountId, defaultReady) }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 422 && data.validationErrors) {
          const errors: Record<string, RowErrors> = {}
          for (const ve of data.validationErrors) {
            const row = rows[ve.index]
            if (row) errors[row.id] = ve.fields
          }
          setRowErrors(errors)
          toast(t('bulkForm.fixFields'), 'error')
        } else {
          toast(data.error ?? t('bulk.saveFailedToast'), 'error')
        }
        return
      }

      toast(data.inserted === 1 ? t('bulk.addedToastOne') : t('bulk.addedToast').replace('{n}', String(data.inserted)), 'success')
      onSuccess()
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const errorMessages = rows.flatMap((row, i) => {
    const errors = rowErrors[row.id]
    return errors && Object.keys(errors).length > 0 ? [lineErrorMessage(i + 1, errors, t)] : []
  })

  // Net: income in, expense and savings out of spendable money (same as the mobile sheet)
  const net = rows.reduce((sum, r) => {
    const amount = Number(r.amount) || 0
    return sum + (r.type === 'income' ? amount : -amount)
  }, 0)
  const symbol = getCurrencySymbol(currency)

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <div className={styles.sharedRow}>
          <div className={styles.sharedField}>
            <Input id="bulk-date" label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className={styles.sharedField}>
            <Select
              tone="token"
              label={t('form.account')}
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
              placeholder={accountPending ? t('common.defaultAccount') : t('common.unassigned')}
            />
          </div>
          <span className={styles.sharedHint}>{t('bulkForm.applies')}</span>
        </div>

        <div>
          <div className={styles.table} role="table" aria-label={t('nav.transactions')}>
            <div className={`${styles.tableRow} ${styles.tableHead}`} role="row">
              <span role="columnheader" style={{ textAlign: 'center' }}>#</span>
              <span role="columnheader">{t('common.type')}</span>
              <span role="columnheader">{t('common.amount')}</span>
              <span role="columnheader">{t('common.category')}</span>
              <span role="columnheader">{t('common.description')}</span>
              <span role="columnheader" aria-label={t('tx.recurring')} />
              <span role="columnheader" aria-label={t('common.delete')} />
            </div>

            {rows.map((row, index) => {
              const errors = rowErrors[row.id] ?? {}
              const hasRowError = Object.keys(errors).length > 0
              const isLast = index === rows.length - 1
              const lineNo = index + 1
              return (
                <div
                  key={row.id}
                  role="row"
                  className={`${styles.tableRow} ${hasRowError ? styles.tableRowInvalid : ''}`}
                >
                  <span className={styles.rowNum}>{lineNo}</span>

                  <div className={styles.miniSeg} role="radiogroup" aria-label={`Line ${lineNo} type`}>
                    {TYPE_OPTIONS.map(({ value, Icon, color }) => {
                      const label = t(`common.${value}`)
                      const on = row.type === value
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={label}
                          title={label}
                          className={`${styles.miniSegBtn} ${on ? styles.miniSegOn : ''}`}
                          style={on ? { color } : undefined}
                          onClick={() => updateRow(row.id, { type: value })}
                        >
                          <Icon size={15} />
                        </button>
                      )
                    })}
                  </div>

                  <label className={`${styles.cell} ${errors.amount ? styles.cellInvalid : ''}`}>
                    <span className={styles.cellPrefix}>{symbol}</span>
                    <input
                      ref={(el) => {
                        if (el) amountRefs.current.set(row.id, el)
                        else amountRefs.current.delete(row.id)
                      }}
                      className={`${styles.cellInput} ${styles.cellAmount}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Line ${lineNo} amount`}
                      aria-invalid={!!errors.amount || undefined}
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: sanitizeAmount(e.target.value) })}
                    />
                  </label>

                  <label className={`${styles.cell} ${errors.category ? styles.cellInvalid : ''}`}>
                    <select
                      className={`${styles.cellInput} ${styles.cellSelect}`}
                      aria-label={`Line ${lineNo} category`}
                      aria-invalid={!!errors.category || undefined}
                      value={row.category}
                      onChange={(e) => updateRow(row.id, { category: e.target.value })}
                      style={row.category ? undefined : { color: 'var(--color-text-muted)' }}
                    >
                      <option value="" disabled>
                        {t('form.selectCategory')}
                      </option>
                      {categoryOptionsFor(row.type).map((c) => (
                        <option key={c._id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className={styles.cellChevron} />
                  </label>

                  <label className={styles.cell}>
                    <input
                      className={styles.cellInput}
                      type="text"
                      placeholder={t('form.notePlaceholder')}
                      aria-label={`Line ${lineNo} description`}
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      onKeyDown={(e) => {
                        // Enter on the last line's last field starts a new line
                        if (e.key === 'Enter' && isLast) {
                          e.preventDefault()
                          addRow()
                        }
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    aria-pressed={row.isRecurring}
                    aria-label={`Line ${lineNo} repeats every month`}
                    title={t('form.repeatsMonthly')}
                    className={`${styles.iconToggle} ${row.isRecurring ? styles.iconToggleOn : ''}`}
                    onClick={() => updateRow(row.id, { isRecurring: !row.isRecurring })}
                  >
                    <Repeat size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className={styles.iconButton}
                    aria-label={`Remove line ${lineNo}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}

            <div className={styles.tableFoot}>
              <button type="button" onClick={addRow} className={styles.addLine}>
                <Plus size={15} />
                {t('bulkForm.addLine')}
              </button>
              <span className={styles.hint}>{t('bulkForm.enterHint')}</span>
            </div>
          </div>

          {errorMessages.length > 0 && (
            <ul className={styles.lineErrors} role="alert" style={{ marginTop: 10 }}>
              {errorMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.footerSplit}>
        <div className={styles.net}>
          <span className={styles.eyebrow}>{t('bulk.net')}</span>
          <span
            className={styles.netValue}
            style={{ color: net < 0 ? 'var(--color-expense)' : net > 0 ? 'var(--color-income)' : 'var(--color-text-primary)' }}
          >
            {net < 0 ? '−' : net > 0 ? '+' : ''}
            {moneyLabel(net, currency)}
          </span>
        </div>
        <Button type="button" variant="outline" onClick={onCancel} style={{ minWidth: 110 }}>
          {t('common.cancel')}
        </Button>
        <Button type="button" loading={loading} onClick={handleSubmit} style={{ minWidth: 200 }}>
          {rows.length === 1 ? t('bulk.saveOne') : t('bulk.save').replace('{n}', String(rows.length))}
        </Button>
      </div>
    </div>
  )
}
