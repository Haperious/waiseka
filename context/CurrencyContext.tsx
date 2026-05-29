'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { formatAmount, getCurrencySymbol, CurrencyCode } from '@/lib/currency'

interface CurrencyContextValue {
  currency: CurrencyCode
  currencySymbol: string
  formatAmount: (amount: number) => string
  setCurrency: (code: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'PHP',
  currencySymbol: '₱',
  formatAmount: (n) => `₱ ${n.toFixed(2)}`,
  setCurrency: () => {},
})

export function CurrencyProvider({ children, initialCurrency }: { children: React.ReactNode; initialCurrency?: CurrencyCode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency ?? 'PHP')

  useEffect(() => {
    if (initialCurrency) setCurrencyState(initialCurrency)
  }, [initialCurrency])

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code)
  }, [])

  const value: CurrencyContextValue = {
    currency,
    currencySymbol: getCurrencySymbol(currency),
    formatAmount: (amount: number) => formatAmount(amount, currency),
    setCurrency,
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
