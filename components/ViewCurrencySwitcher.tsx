'use client'

import { useViewCurrency } from '@/context/ViewCurrencyContext'
import { getAllCurrencies } from '@/lib/currency'

const INFO = new Map(getAllCurrencies().map((c) => [c.code, c]))

/**
 * QAR | PHP chips that pick the currency summaries are shown in. Renders nothing for
 * users whose active accounts are all in one currency (PRD D1).
 */
export default function ViewCurrencySwitcher() {
  const { viewCurrency, setViewCurrency, currencies, isMultiCurrency } = useViewCurrency()
  if (!isMultiCurrency) return null

  return (
    <div
      role="radiogroup"
      aria-label="View currency"
      style={{
        display: 'inline-flex', gap: 4, padding: 3, borderRadius: 999,
        border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)',
      }}
    >
      {currencies.map((code) => {
        const active = code === viewCurrency
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setViewCurrency(code)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 700,
              backgroundColor: active ? 'var(--color-sage)' : 'transparent',
              color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            }}
          >
            <span aria-hidden>{INFO.get(code)?.flag}</span>
            {code}
          </button>
        )
      })}
    </div>
  )
}
