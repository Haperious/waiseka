'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  X, CalendarDays, Wallet, ChevronDown, Trash2, Pencil, Plus,
  CheckCircle, TrendingUp, TrendingDown, PiggyBank,
} from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrency } from '@/context/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { emitTransactionSaved } from '@/lib/transactionEvents'
import Keypad from '@/components/quick-add/Keypad'
import { ChipScroller } from '@/components/quick-add/QuickAddSheet'

type TxType = 'expense' | 'income' | 'savings'

interface BulkLine {
  id: string
  type: TxType
  amount: number
  category: string
  description: string
}

interface BulkAddSheetProps {
  open: boolean
  onSuccess: () => void
  onCancel: () => void
}

const KEYPAD_KEYS = ['1', '2', '3', 'del', '4', '5', '6', '7', '8', '9', '00', '0', '.']

/** Parses a 'yyyy-MM-dd' string as a local-midnight Date, avoiding the UTC-shift that `new Date(str)` introduces. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function typeVisual(type: TxType) {
  return type === 'income'
    ? { Icon: TrendingUp, color: 'var(--color-income)', bg: 'var(--color-income-bg)' }
    : type === 'savings'
    ? { Icon: PiggyBank, color: 'var(--color-savings)', bg: 'var(--color-savings-bg)' }
    : { Icon: TrendingDown, color: 'var(--color-expense)', bg: 'var(--color-expense-bg)' }
}

/** Net counts income as inflow and both expense and savings as outflow from spendable money. */
function signedNetAmount(line: BulkLine): number {
  return line.type === 'income' ? line.amount : -line.amount
}

export default function BulkAddSheet({ open, onSuccess, onCancel }: BulkAddSheetProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { currency, currencySymbol, formatAmount } = useCurrency()

  const [visible, setVisible] = useState(false)
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [accountId, setAccountId] = useState('')
  const [lines, setLines] = useState<BulkLine[]>([])
  const [lineErrors, setLineErrors] = useState<Record<string, Record<string, string>>>({})

  const [type, setType] = useState<TxType>('expense')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const ledgerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts])
  const accountLabel = accountId
    ? (activeAccounts.find((a) => a._id === accountId)?.name ?? t('bulk.unassigned'))
    : t('bulk.unassigned')

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.type === type || c.type === 'both' || type === 'savings'),
    [categories, type]
  )

  const requestClose = useCallback(() => {
    if (lines.length > 0) setDiscardOpen(true)
    else onCancel()
  }, [lines.length, onCancel])

  const confirmDiscard = () => {
    setLines([])
    setLineErrors({})
    setDiscardOpen(false)
    onCancel()
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const raf = requestAnimationFrame(() => setVisible(true))
      closeBtnRef.current?.focus()
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    document.body.style.overflow = ''
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, requestClose])

  if (!open) return null

  const handleTypeChange = (next: TxType) => {
    setType(next)
    setCategory('')
  }

  const amountValue = Number(amountStr)
  const canAdd = amountStr !== '' && amountValue > 0 && !!category

  const handleAdd = () => {
    if (!canAdd) return
    const newLine: BulkLine = {
      id: crypto.randomUUID(),
      type,
      amount: amountValue,
      category,
      description: description.trim(),
    }
    setLines((prev) => [...prev, newLine])
    setAmountStr('')
    setDescription('')
    requestAnimationFrame(() => {
      ledgerRef.current?.scrollTo({ top: ledgerRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const handleDeleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
    setLineErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const net = lines.reduce((sum, l) => sum + signedNetAmount(l), 0)

  const handleSave = async () => {
    if (lines.length === 0 || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: lines.map((l) => ({
            type: l.type,
            amount: l.amount,
            category: l.category,
            description: l.description,
            date,
            currency,
          })),
          accountId: accountId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 422 && Array.isArray(data.validationErrors)) {
          const errors: Record<string, Record<string, string>> = {}
          for (const ve of data.validationErrors as { index: number; fields: Record<string, string> }[]) {
            const line = lines[ve.index]
            if (line) errors[line.id] = ve.fields
          }
          setLineErrors(errors)
          toast(t('bulk.fixLines'), 'error')
        } else {
          toast(data.error ?? t('bulk.saveFailedToast'), 'error')
        }
        return
      }

      toast(data.inserted === 1 ? t('bulk.addedToastOne') : t('bulk.addedToast').replace('{n}', String(data.inserted)), 'success')
      emitTransactionSaved()
      setLines([])
      setLineErrors({})
      onSuccess()
    } catch {
      toast(t('common.genericError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pillStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    flex: 1, minWidth: 0,
    height: 38, padding: '0 12px',
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-elevated)',
    color: 'var(--color-text-primary)',
    fontSize: '0.78rem', fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  const saveLabel = lines.length === 1 ? t('bulk.saveOne') : t('bulk.save').replace('{n}', String(lines.length))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-add-title"
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        height: '100dvh',
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          height: 54, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 6px 0 6px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={requestClose}
          aria-label={t('common.close')}
          style={{
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
        <h2
          id="bulk-add-title"
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          {t('bulk.title')}
        </h2>
        <span
          style={{
            fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right', paddingRight: 12,
          }}
        >
          {t('bulk.lineCount').replace('{n}', String(lines.length))}
        </span>
      </div>

      {/* ── Context strip ───────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0, padding: '10px 14px 12px',
          backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        }}
      >
        <p style={{
          fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.09em',
          color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8,
        }}>
          {t('bulk.appliesToAll')}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setDatePickerOpen(true)} style={pillStyle}>
            <CalendarDays style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--color-text-muted)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {format(parseLocalDate(date), 'd MMM yyyy')}
            </span>
          </button>
          <button type="button" onClick={() => setAccountPickerOpen(true)} style={pillStyle}>
            <Wallet style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--color-text-muted)' }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {accountLabel}
            </span>
            <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      </div>

      {/* ── Ledger ───────────────────────────────────────────────────── */}
      <div ref={ledgerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px' }}>
        {lines.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)',
          }}>
            <Wallet style={{ width: 24, height: 24 }} />
            <p style={{ fontSize: '0.82rem' }}>{t('bulk.empty')}</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {lines.map((line) => {
              const visual = typeVisual(line.type)
              const errors = lineErrors[line.id]
              const hasError = !!errors
              const sign = line.type === 'expense' ? '−' : '+'
              return (
                <li
                  key={line.id}
                  aria-label={`${line.category}, ${sign}${formatAmount(line.amount)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 11px', borderRadius: 12,
                    backgroundColor: hasError ? 'var(--color-expense-bg)' : 'var(--color-card)',
                    border: hasError ? '1px solid #EF4444' : '1px solid var(--color-border)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    animation: 'bulkLineIn 0.22s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: visual.bg, color: visual.color,
                  }}>
                    <visual.Icon style={{ width: 14, height: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {line.category}
                    </p>
                    <p style={{
                      fontSize: '0.68rem', color: 'var(--color-text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {line.description || t('bulk.noDescription')} · {accountLabel}
                    </p>
                    {hasError && (
                      <p style={{ fontSize: '0.65rem', color: 'var(--color-expense)', marginTop: 2 }}>
                        {Object.values(errors).join(', ')}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontWeight: 800, fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums',
                    color: visual.color, flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {sign}{formatAmount(line.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteLine(line.id)}
                    aria-label={t('bulk.removeLineAria').replace('{category}', line.category)}
                    style={{
                      width: 44, height: 44, flexShrink: 0, marginRight: -10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {lines.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '8px 2px 2px' }}>
            <span style={{
              fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.09em',
              color: 'var(--color-text-muted)', textTransform: 'uppercase',
            }}>
              {t('bulk.runningNet')}
            </span>
            <span style={{
              fontSize: '0.82rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
            }}>
              {net >= 0 ? '+' : '−'}{formatAmount(Math.abs(net))}
            </span>
          </div>
        )}
      </div>

      {/* ── Composer ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
        padding: '10px 14px 8px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
          padding: 4, borderRadius: 999, backgroundColor: 'var(--color-elevated)', marginBottom: 10,
        }}>
          {(['expense', 'income', 'savings'] as TxType[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleTypeChange(opt)}
              style={{
                height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize',
                transition: 'all 0.2s',
                backgroundColor: type === opt ? 'var(--color-card)' : 'transparent',
                color: type === opt ? `var(--color-${opt})` : 'var(--color-text-secondary)',
              }}
            >
              {t(`common.${opt}` as const)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.09em',
            color: 'var(--color-text-muted)', textTransform: 'uppercase',
          }}>
            {t('bulk.newLine')}
          </span>
          <span
            aria-live="polite"
            style={{
              fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: amountStr ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {currencySymbol} {amountStr || '0.00'}
          </span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <ChipScroller
            items={categoryOptions.map((c) => ({ id: c.name, label: c.name }))}
            selected={category}
            onSelect={setCategory}
            emptyLabel={t('quickAdd.selectCategory')}
          />
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Pencil style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 13, height: 13, color: 'var(--color-text-muted)',
          }} />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('bulk.descPlaceholder')}
            style={{
              width: '100%', height: 38, borderRadius: 8, border: 'none',
              paddingLeft: 34, paddingRight: 12,
              backgroundColor: 'var(--color-elevated)', color: 'var(--color-text-primary)',
              fontSize: '0.82rem', outline: 'none',
            }}
          />
        </div>

        <Keypad
          value={amountStr}
          onChange={setAmountStr}
          keys={KEYPAD_KEYS}
          columns={4}
          keyHeight={42}
          maxDecimals={2}
          maxDigits={9}
          actionKey={{
            label: t('bulk.add'),
            icon: <Plus style={{ width: 18, height: 18 }} />,
            onClick: handleAdd,
            disabled: !canAdd,
            ariaLabel: t('bulk.addLineAria'),
          }}
        />
      </div>

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
        padding: '10px 14px 16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flexShrink: 0 }}>
          <p style={{
            fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.09em',
            color: 'var(--color-text-muted)', textTransform: 'uppercase',
          }}>
            {t('bulk.net')}
          </p>
          <p style={{
            fontSize: '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
          }}>
            {net >= 0 ? '+' : '−'}{formatAmount(Math.abs(net))}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={lines.length === 0 || saving}
          className="disabled:pointer-events-none"
          style={{
            flex: 1, height: 46, borderRadius: 12, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontWeight: 700, fontSize: '0.9rem', color: 'white',
            background: 'linear-gradient(135deg, #166534, #16A34A)',
            boxShadow: lines.length === 0 ? 'none' : '0 4px 20px rgba(22,163,74,.35)',
            opacity: lines.length === 0 ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          <CheckCircle style={{ width: 16, height: 16 }} />
          {saving ? t('quickAdd.saving') : saveLabel}
        </button>
      </div>

      {/* ── Date picker sheet ───────────────────────────────────────── */}
      {datePickerOpen && (
        <PickerOverlay onClose={() => setDatePickerOpen(false)} title={t('common.date')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 4px 12px' }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)',
                color: 'var(--color-text-primary)', fontSize: '0.88rem', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
              style={{
                alignSelf: 'flex-start', fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >
              {t('common.today')}
            </button>
          </div>
        </PickerOverlay>
      )}

      {/* ── Account picker sheet ─────────────────────────────────────── */}
      {accountPickerOpen && (
        <PickerOverlay onClose={() => setAccountPickerOpen(false)} title={t('quickAdd.account')}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[{ _id: '', name: t('bulk.unassigned'), computedBalance: undefined as number | undefined }, ...activeAccounts].map((a) => {
              const isSelected = a._id === accountId
              return (
                <li key={a._id || '__unassigned__'}>
                  <button
                    type="button"
                    onClick={() => { setAccountId(a._id); setAccountPickerOpen(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: isSelected ? 'var(--color-sage)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                      color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: 500,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span>{a.name}</span>
                    {a.computedBalance !== undefined && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(a.computedBalance)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </PickerOverlay>
      )}

      {/* ── Discard confirm ──────────────────────────────────────────── */}
      {discardOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-backdrop)' }}>
          <div style={{
            width: '100%', maxWidth: 340, borderRadius: 16, padding: 20,
            backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
              {t('bulk.discardTitle').replace('{n}', String(lines.length))}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              {t('bulk.discardBody')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDiscardOpen(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 10, border: '1px solid var(--color-border)',
                  backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t('bulk.discardCancel')}
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                style={{
                  flex: 1, height: 42, borderRadius: 10, border: 'none',
                  backgroundColor: 'var(--color-expense)', color: 'white',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t('bulk.discardConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function PickerOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end">
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--color-backdrop)', backdropFilter: 'blur(4px)' }}
      />
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '16px 18px', paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
          maxHeight: '60vh', overflowY: 'auto',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'var(--color-elevated)', borderRadius: 8,
              color: 'var(--color-text-muted)', cursor: 'pointer',
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
