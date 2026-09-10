'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

export interface Account {
  _id: string
  userId: string
  name: string
  institution?: string
  type: 'debit' | 'credit' | 'savings' | 'time_deposit' | 'cash' | 'e_wallet'
  openingBalance: number
  currency: 'PHP' | 'QAR' | 'USD'
  creditLimit?: number | null
  dueDay?: number | null
  lowBalanceThreshold?: number | null
  color?: string | null
  icon?: string | null
  displayOrder: number
  isArchived: boolean
  includeInTotal: boolean
  createdAt: string
  /** Derived on read from transactions - present on asset accounts (debit, savings, time_deposit, cash, e_wallet). */
  computedBalance?: number
  /** Derived on read from transactions - present on credit accounts only. */
  outstandingBalance?: number
  /** creditLimit - outstandingBalance. Null if no creditLimit is set. Credit accounts only. */
  availableCredit?: number | null
}

interface AccountsContextValue {
  accounts: Account[]
  loading: boolean
  error: string | null
  createAccount: (
    data: Omit<Account, '_id' | 'userId' | 'displayOrder' | 'isArchived' | 'createdAt'>
  ) => Promise<Account>
  updateAccount: (id: string, data: Partial<Account>) => Promise<Account>
  archiveAccount: (id: string) => Promise<void>
  unarchiveAccount: (id: string) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

const AccountsContext = createContext<AccountsContextValue | null>(null)

// Backs every useAccounts() call in the app with one shared fetch/cache instead of
// each consumer (dashboard, command palette, settings, etc.) independently hitting
// /api/accounts on mount.
export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/accounts')
    if (!res.ok) throw new Error(await extractApiError(res))
    return res.json() as Promise<Account[]>
  }, [])

  const { execute, loading, error } = useFetch(fetcher)

  const fetchAccounts = useCallback(async () => {
    const data = await execute()
    if (data) setAccounts(Array.isArray(data) ? data : [])
  }, [execute])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const createAccount = useCallback(async (
    data: Omit<Account, '_id' | 'userId' | 'displayOrder' | 'isArchived' | 'createdAt'>
  ): Promise<Account> => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Account = await res.json()
    setAccounts((prev) => [...prev, created])
    return created
  }, [])

  const updateAccount = useCallback(async (id: string, data: Partial<Account>): Promise<Account> => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Account = await res.json()
    setAccounts((prev) => prev.map((a) => (a._id === id ? updated : a)))
    return updated
  }, [])

  // Archive/unarchive via a full refetch rather than the PUT response - the PUT
  // route doesn't recompute balances, so patching state locally would momentarily
  // drop computedBalance/outstandingBalance from the affected account.
  const archiveAccount = useCallback(async (id: string) => {
    await updateAccount(id, { isArchived: true })
    await fetchAccounts()
  }, [updateAccount, fetchAccounts])

  const unarchiveAccount = useCallback(async (id: string) => {
    await updateAccount(id, { isArchived: false })
    await fetchAccounts()
  }, [updateAccount, fetchAccounts])

  const deleteAccount = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await extractApiError(res))
    setAccounts((prev) => prev.filter((a) => a._id !== id))
  }, [])

  const value = useMemo<AccountsContextValue>(() => ({
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    archiveAccount,
    unarchiveAccount,
    deleteAccount,
    refetch: fetchAccounts,
  }), [accounts, loading, error, createAccount, updateAccount, archiveAccount, unarchiveAccount, deleteAccount, fetchAccounts])

  return React.createElement(AccountsContext.Provider, { value }, children)
}

export function useAccounts(): AccountsContextValue {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts must be used within an AccountsProvider')
  return ctx
}
