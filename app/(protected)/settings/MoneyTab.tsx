'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences, type Preferences } from '@/hooks/usePreferences'
import { getAllCurrencies, CurrencyCode } from '@/lib/currency'
import { errorMessage, numberInputStyle, selectionCardStyle, type SettingsTabProps } from './shared'
import styles from './settings.module.css'

type CutoffMode = 'semi-monthly' | 'monthly' | 'custom'

interface CutoffSettings {
  mode: CutoffMode
  midDay: number
  customDays: number[]
}

/** The saved cutoff schedule, in the shape the form edits. */
function cutoffFromPreferences(preferences: Preferences | null): CutoffSettings {
  const mode = preferences?.cutoffMode ?? 'semi-monthly'
  const days = preferences?.cutoffDays ?? [15, 30]
  return {
    mode,
    midDay: days.find((day) => day < 30) ?? 15,
    customDays: mode === 'custom' ? days : [10, 20],
  }
}

export default function MoneyTab({ hidden }: SettingsTabProps) {
  const { preferences } = usePreferences()
  // The account and cutoff forms start from the saved preferences - remount them once
  // those load so their initial state is right.
  const formKey = preferences ? 'loaded' : 'loading'

  return (
    <div className={styles.panelBody} hidden={hidden}>
      <CurrencySection />
      <DefaultAccountSection key={`account-${formKey}`} />
      <CutoffSection key={`cutoff-${formKey}`} />
    </div>
  )
}

// ── Currency ─────────────────────────────────────────────────────────────────
function CurrencySection() {
  const { currency, setCurrency, formatAmount } = useCurrency()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { update: updatePreferences } = usePreferences()
  const currencies = getAllCurrencies()
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (selectedCurrency === currency) return
    setLoading(true)
    try {
      await updatePreferences({ currency: selectedCurrency })
      setCurrency(selectedCurrency)
      const info = currencies.find((c) => c.code === selectedCurrency)
      toast(`Currency updated to ${info?.label} ${info?.symbol}`, 'success')
    } catch (err) {
      toast(errorMessage(err, 'Failed to update currency'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fieldGroup}>
      <p className={styles.groupLabel}>{t('settings.currency')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${currencies.length}, 1fr)`, gap: 10 }}>
          {currencies.map((c) => {
            const isActive = selectedCurrency === c.code
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => setSelectedCurrency(c.code as CurrencyCode)}
                style={selectionCardStyle(isActive)}
              >
                <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{c.flag}</span>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.code}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{c.label}</p>
                <p style={{ fontSize: '0.92rem', fontWeight: 800, color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                  {c.symbol}
                </p>
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Amounts show as entered. WaiseKa never converts.
        </p>
        {selectedCurrency !== currency && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-warning)', padding: '8px 12px', borderRadius: 8, backgroundColor: 'var(--color-warning-bg)' }}>
            Preview: {formatAmount(1500)} &rarr; amounts will display in {selectedCurrency}
          </p>
        )}
        <div>
          <Button onClick={handleSave} loading={loading} disabled={selectedCurrency === currency}>
            {t('settings.saveCurrency')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Default account ──────────────────────────────────────────────────────────
function DefaultAccountSection() {
  const { toast } = useToast()
  const { accounts } = useAccounts()
  const { preferences, update: updatePreferences } = usePreferences()
  const activeAccounts = accounts.filter((a) => !a.isArchived)
  const savedAccountId = preferences?.defaultAccountId ?? ''
  const [accountId, setAccountId] = useState(savedAccountId)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (accountId === savedAccountId) return
    setLoading(true)
    try {
      await updatePreferences({ defaultAccountId: accountId || null })
      toast('Default account updated', 'success')
    } catch (err) {
      toast(errorMessage(err, 'Failed to update default account'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fieldGroup}>
      <p className={styles.groupLabel}>Default account</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Pre-selected when you log a transaction.
        </p>
        {activeAccounts.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Add an account first to set a default.
          </p>
        ) : (
          <>
            <Select
              value={accountId}
              onValueChange={setAccountId}
              options={activeAccounts.map((a) => ({ value: a._id, label: a.name }))}
              placeholder="Select an account"
              className={styles.selectFull}
            />
            <div>
              <Button onClick={handleSave} loading={loading} disabled={accountId === savedAccountId}>
                Save Default Account
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sweldo cutoff ────────────────────────────────────────────────────────────
function CutoffSection() {
  const { toast } = useToast()
  const { preferences, update: updatePreferences } = usePreferences()
  const saved = cutoffFromPreferences(preferences)
  const [cutoffMode, setCutoffMode] = useState<CutoffMode>(saved.mode)
  const [cutoffMidDay, setCutoffMidDay] = useState(saved.midDay)
  const [customCutoffDays, setCustomCutoffDays] = useState<number[]>(saved.customDays)
  const [loading, setLoading] = useState(false)

  const resolvedCutoffDays = (mode: CutoffMode) =>
    mode === 'monthly' ? [30] : mode === 'semi-monthly' ? [cutoffMidDay, 30] : customCutoffDays

  const isDirty =
    cutoffMode !== saved.mode ||
    (cutoffMode === 'semi-monthly' && cutoffMidDay !== saved.midDay) ||
    (cutoffMode === 'custom' &&
      (customCutoffDays.length !== saved.customDays.length ||
        customCutoffDays.some((d, i) => d !== saved.customDays[i])))

  const handleSave = async () => {
    const days = resolvedCutoffDays(cutoffMode)
    if (cutoffMode === 'custom' && days.length === 0) {
      toast('Add at least one cutoff day', 'error')
      return
    }
    setLoading(true)
    try {
      await updatePreferences({ cutoffMode, cutoffDays: days })
      toast('Cutoff schedule updated', 'success')
    } catch (err) {
      toast(errorMessage(err, 'Failed to update cutoff schedule'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fieldGroup}>
      <p className={styles.groupLabel}>Sweldo cutoff</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {([
            { mode: 'semi-monthly', label: 'Semi-monthly', hint: 'Twice a month' },
            { mode: 'monthly', label: 'Monthly', hint: 'Once a month' },
            { mode: 'custom', label: 'Custom', hint: 'Up to 4 cutoffs' },
          ] as const).map(({ mode, label, hint }) => {
            const isActive = cutoffMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setCutoffMode(mode)}
                style={{ ...selectionCardStyle(isActive), minWidth: 100, flex: '1 1 100px' }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                  {label}
                </span>
                <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>{hint}</span>
              </button>
            )
          })}
        </div>

        {cutoffMode === 'semi-monthly' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>Mid-month cutoff on day</span>
            <input
              type="number"
              min={1}
              max={29}
              value={cutoffMidDay}
              onChange={(e) => setCutoffMidDay(Math.min(29, Math.max(1, Number(e.target.value) || 1)))}
              style={numberInputStyle}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>then again at month end</span>
          </div>
        )}

        {cutoffMode === 'monthly' && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
            One period per month, resetting on the last day.
          </p>
        )}

        {cutoffMode === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Periods always stay within a calendar month, but you can add up to 4 cutoff days for a
              closer-to-weekly rhythm - e.g. 7 / 14 / 21 / 28.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {customCutoffDays.map((day, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)',
                    borderRadius: 10, padding: '4px 6px',
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={day}
                    onChange={(e) => {
                      const v = Math.min(31, Math.max(1, Number(e.target.value) || 1))
                      setCustomCutoffDays((days) => days.map((d, idx) => (idx === i ? v : d)))
                    }}
                    style={numberInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomCutoffDays((days) => days.filter((_, idx) => idx !== i))}
                    style={{ color: 'var(--color-text-muted)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    aria-label="Remove cutoff day"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {customCutoffDays.length < 4 && (
                <button
                  type="button"
                  onClick={() => setCustomCutoffDays((days) => [...days, 30])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600,
                    color: 'var(--color-accent)', border: '1px dashed var(--color-border)', borderRadius: 10,
                    padding: '6px 10px', backgroundColor: 'transparent', cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add day
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCustomCutoffDays([7, 14, 21, 28])}
              style={{
                alignSelf: 'flex-start', fontSize: '0.74rem', fontWeight: 600,
                color: 'var(--color-text-secondary)', textDecoration: 'underline',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              Use weekly preset (7 / 14 / 21 / 28)
            </button>
          </div>
        )}

        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          3 days before a recurring bill lands, WaiseKa uses this schedule to reset your safe-to-spend total.
        </p>

        <div>
          <Button onClick={handleSave} loading={loading} disabled={!isDirty}>
            Save Cutoff Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}
