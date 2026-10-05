'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { formatAmount, getCurrencySymbol, CurrencyCode } from '@/lib/currency'

interface CurrencyContextValue {
  currency: CurrencyCode
  currencySymbol: string
  formatAmount: (amount: number) => string
  /** Formats in a specific currency (e.g. a transaction's or account's), falling back to the primary. */
  formatAmountIn: (amount: number, code?: string | null) => string
  setCurrency: (code: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'PHP',
  currencySymbol: '₱',
  formatAmount: (n) => `₱ ${n.toFixed(2)}`,
  formatAmountIn: (n) => `₱ ${n.toFixed(2)}`,
  setCurrency: () => {},
})

export function CurrencyProvider({ children, initialCurrency }: { children: React.ReactNode; initialCurrency?: CurrencyCode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency ?? 'PHP')

  // Follow a new server-provided currency (e.g. after login) - adjusted during render
  // rather than in an effect, so there's no frame showing the stale currency.
  const [prevInitial, setPrevInitial] = useState(initialCurrency)
  if (initialCurrency !== prevInitial) {
    setPrevInitial(initialCurrency)
    if (initialCurrency) setCurrencyState(initialCurrency)
  }

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code)
  }, [])

  const value: CurrencyContextValue = {
    currency,
    currencySymbol: getCurrencySymbol(currency),
    formatAmount: (amount: number) => formatAmount(amount, currency),
    formatAmountIn: (amount: number, code?: string | null) => formatAmount(amount, code || currency),
    setCurrency,
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
