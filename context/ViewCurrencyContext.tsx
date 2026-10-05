'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useCurrency } from '@/context/CurrencyContext'
import { formatAmount, type CurrencyCode } from '@/lib/currency'
import { isCurrencyCode, sortCurrencies } from '@/lib/services/currencyScope'

const STORAGE_KEY = 'waiseka_view_currency'

/**
 * Where the switcher choice is remembered (PRD D7: per browser for now). Everything
 * reads and writes through this one hook, so moving the choice to the account later
 * only means changing this function.
 */
function useStoredViewCurrency(): [string | null, (code: CurrencyCode) => void] {
  return useLocalStorage(STORAGE_KEY)
}

interface ViewCurrencyContextValue {
  /** The currency summaries are shown in. Always one of `currencies`. */
  viewCurrency: CurrencyCode
  setViewCurrency: (code: CurrencyCode) => void
  /** Currencies of the user's active accounts, primary first. Always includes the primary. */
  currencies: CurrencyCode[]
  /** 2+ currencies - the only case that shows any multi-currency UI (PRD D1). */
  isMultiCurrency: boolean
  /** Formats an amount in the view currency. */
  formatView: (amount: number) => string
}

const ViewCurrencyContext = createContext<ViewCurrencyContextValue | null>(null)

export function ViewCurrencyProvider({ children }: { children: ReactNode }) {
  const { currency: primary } = useCurrency()
  const { accounts } = useAccounts()
  const [stored, setStored] = useStoredViewCurrency()

  const currencies = useMemo(
    () => sortCurrencies([primary, ...accounts.filter((a) => !a.isArchived).map((a) => a.currency)], primary),
    [accounts, primary],
  )

  // A stale choice (e.g. its last account was archived) falls back to the primary
  const viewCurrency: CurrencyCode =
    isCurrencyCode(stored) && currencies.includes(stored) ? stored : primary

  const value = useMemo<ViewCurrencyContextValue>(() => ({
    viewCurrency,
    setViewCurrency: setStored,
    currencies,
    isMultiCurrency: currencies.length > 1,
    formatView: (amount: number) => formatAmount(amount, viewCurrency),
  }), [viewCurrency, setStored, currencies])

  return <ViewCurrencyContext.Provider value={value}>{children}</ViewCurrencyContext.Provider>
}

export function useViewCurrency(): ViewCurrencyContextValue {
  const ctx = useContext(ViewCurrencyContext)
  if (!ctx) throw new Error('useViewCurrency must be used within a ViewCurrencyProvider')
  return ctx
}
