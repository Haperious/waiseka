'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { formatAmount, getCurrencySymbol, CurrencyCode } from '@/lib/currency'

interface CurrencyContextValue {
  currency: CurrencyCode
  currencySymbol: string
  formatAmount: (amount: number) => string
  setCurrency: (code: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  currencySymbol: '$',
  formatAmount: (n) => `$ ${n.toFixed(2)}`,
  setCurrency: () => {},
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD')

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((data) => {
        if (data?.preferences?.currency) {
          setCurrencyState(data.preferences.currency as CurrencyCode)
        }
      })
      .catch(() => {})
  }, [])

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
