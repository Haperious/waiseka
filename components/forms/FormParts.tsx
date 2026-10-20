'use client'

import { forwardRef, useState, type ReactNode } from 'react'
import { Search, type LucideIcon } from 'lucide-react'
import { getCurrencySymbol } from '@/lib/currency'
import { orderCategoryChips } from '@/lib/categoryChips'
import { useLanguage } from '@/context/LanguageContext'
import styles from './forms.module.css'

/**
 * "₱245.00" - symbol hugging the number, for button labels ("Add expense · ₱245.00").
 * `whole` drops the centavos for round figures in running text ("₱2,350 per cutoff").
 */
export function moneyLabel(amount: number, currency: string, { whole = false } = {}): string {
  const digits = whole ? 0 : 2
  const abs = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${getCurrencySymbol(currency)}${abs}`
}

/**
 * Keeps digits and a single decimal point (max 2 decimals) for amount fields typed on a keyboard.
 * `allowNegative` keeps one leading minus (an overdrawn balance, a card in credit).
 */
export function sanitizeAmount(raw: string, { allowNegative = false } = {}): string {
  const negative = allowNegative && raw.trim().startsWith('-')
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  const value = rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole
  return negative ? `-${value}` : value
}

export function Field({ label, htmlFor, hint, error, children }: {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
      )}
      {children}
      {error ? <span className={styles.errorText}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}

interface AmountFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  currency: string
  error?: string
  autoFocus?: boolean
  /** Lets the user type a leading minus. */
  allowNegative?: boolean
}

/** Large currency amount input: muted symbol, 2rem/800 tabular digits, accent focus ring. */
export const AmountField = forwardRef<HTMLInputElement, AmountFieldProps>(
  ({ id, label, value, onChange, currency, error, autoFocus, allowNegative }, ref) => (
    <Field label={label} htmlFor={id} error={error}>
      <div className={`${styles.amountBox} ${error ? styles.amountBoxError : ''}`}>
        <span className={styles.amountSymbol}>{getCurrencySymbol(currency)}</span>
        <input
          ref={ref}
          id={id}
          className={styles.amountInput}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          autoFocus={autoFocus}
          aria-invalid={!!error || undefined}
          onChange={(e) => onChange(sanitizeAmount(e.target.value, { allowNegative }))}
        />
      </div>
    </Field>
  )
)
AmountField.displayName = 'AmountField'

export interface SegmentOption<T extends string> {
  value: T
  label?: ReactNode
  icon?: LucideIcon
  /** Text colour when selected (e.g. the transaction type colour). */
  color?: string
  ariaLabel?: string
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const on = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={opt.ariaLabel}
            className={`${styles.segment} ${on ? styles.segmentOn : ''} ${!opt.label ? styles.segmentIcon : ''}`}
            style={on && opt.color ? { color: opt.color } : undefined}
            onClick={() => onChange(opt.value)}
          >
            {Icon && <Icon size={15} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({ selected, dashed, onClick, children }: {
  selected?: boolean
  dashed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${styles.chip} ${selected ? styles.chipOn : ''} ${dashed ? styles.chipDashed : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** How many category chips show before "All categories" (selected one + the most used). */
const CATEGORY_CHIP_LIMIT = 7

/**
 * Wrapping category chips: selected first, then most used, ending with a dashed
 * "All categories" chip that reveals every category.
 */
export function CategoryChips({ categories, value, onChange, label, error }: {
  categories: { name: string; usageCount?: number }[]
  value: string
  onChange: (name: string) => void
  label?: string
  error?: string
}) {
  const { t } = useLanguage()
  label ??= t('common.category')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ordered = orderCategoryChips(categories, value)
  const visible = ordered.slice(0, CATEGORY_CHIP_LIMIT)
  const hasMore = ordered.length > CATEGORY_CHIP_LIMIT
  const q = query.trim().toLowerCase()
  const matches = q ? ordered.filter((c) => c.name.toLowerCase().includes(q)) : ordered

  const closePicker = () => {
    setPickerOpen(false)
    setQuery('')
  }
  const pick = (name: string) => {
    onChange(name)
    closePicker()
  }

  return (
    <Field label={label} error={error}>
      {categories.length === 0 ? (
        <span className={styles.hint}>{t('form.noCategoriesForType')}</span>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label={label}>
            {visible.map((c) => (
              <Chip key={c.name} selected={c.name === value} onClick={() => onChange(c.name)}>
                {c.name}
              </Chip>
            ))}
            {hasMore && (
              <Chip dashed selected={pickerOpen} onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}>
                <Search size={13} />
                {t('form.allCategories')}
              </Chip>
            )}
          </div>
          {pickerOpen && (
            <div className={styles.picker}>
              <div className={styles.pickerSearch}>
                <Search size={14} />
                <input
                  autoFocus
                  type="text"
                  className={styles.pickerInput}
                  placeholder={t('form.searchCategories')}
                  aria-label={t('form.searchCategories')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      // Close the picker, not the whole modal
                      e.preventDefault()
                      e.stopPropagation()
                      closePicker()
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      if (matches.length > 0) pick(matches[0].name)
                    }
                  }}
                />
              </div>
              {matches.length === 0 ? (
                <span className={styles.hint}>{t('form.noCategoryMatch').replace('{q}', query)}</span>
              ) : (
                <div className={styles.chips}>
                  {matches.map((c) => (
                    <Chip key={c.name} selected={c.name === value} onClick={() => pick(c.name)}>
                      {c.name}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Field>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    />
  )
}

export function ToggleRow({ title, sub, checked, onChange }: {
  title: string
  sub?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.toggleRow} onClick={() => onChange(!checked)}>
      <div className={styles.toggleText}>
        <span className={styles.toggleTitle}>{title}</span>
        {sub && <span className={styles.toggleSub}>{sub}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

/** Scrolling body + pinned footer, for use inside a Modal variant="form". */
export function FormModalLayout({ onSubmit, footer, children }: {
  onSubmit: (e: React.FormEvent) => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} className={styles.shell} noValidate>
      <div className={styles.body}>{children}</div>
      <div className={styles.footer}>{footer}</div>
    </form>
  )
}
