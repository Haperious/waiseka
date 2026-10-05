import { describe, it, expect } from 'vitest'
import { currencyScope, isCurrencyCode, primaryCurrencyOf, resolveTransactionCurrency } from './currencyScope'

describe('currencyScope', () => {
  it('includes transactions with no currency when scoping to the primary currency', () => {
    expect(currencyScope('QAR', 'QAR')).toEqual({
      $or: [{ currency: 'QAR' }, { currency: null }, { currency: { $exists: false } }],
    })
  })

  it('matches only the exact currency when it is not the primary', () => {
    expect(currencyScope('PHP', 'QAR')).toEqual({ currency: 'PHP' })
  })
})

describe('resolveTransactionCurrency', () => {
  it('uses the account currency when the transaction has an account', () => {
    expect(resolveTransactionCurrency({ currency: 'PHP' }, 'QAR')).toBe('PHP')
  })

  it('falls back to the primary currency when there is no account', () => {
    expect(resolveTransactionCurrency(null, 'QAR')).toBe('QAR')
    expect(resolveTransactionCurrency(undefined, 'USD')).toBe('USD')
  })

  it('falls back to the primary currency when the account currency is invalid', () => {
    expect(resolveTransactionCurrency({ currency: 'EUR' }, 'QAR')).toBe('QAR')
  })
})

describe('primaryCurrencyOf', () => {
  it('reads preferences.currency', () => {
    expect(primaryCurrencyOf({ preferences: { currency: 'QAR' } })).toBe('QAR')
  })

  it('defaults to PHP when unset or invalid', () => {
    expect(primaryCurrencyOf(null)).toBe('PHP')
    expect(primaryCurrencyOf({})).toBe('PHP')
    expect(primaryCurrencyOf({ preferences: { currency: 'EUR' } })).toBe('PHP')
  })
})

describe('isCurrencyCode', () => {
  it('accepts supported codes only', () => {
    expect(isCurrencyCode('PHP')).toBe(true)
    expect(isCurrencyCode('EUR')).toBe(false)
    expect(isCurrencyCode(undefined)).toBe(false)
  })
})
