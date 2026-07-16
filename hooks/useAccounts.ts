'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function useAccounts() {
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

  const createAccount = async (
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
  }

  const updateAccount = async (id: string, data: Partial<Account>): Promise<Account> => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Account = await res.json()
    setAccounts((prev) => prev.map((a) => (a._id === id ? updated : a)))
    return updated
  }

  // Archive/unarchive via a full refetch rather than the PUT response - the PUT
  // route doesn't recompute balances, so patching state locally would momentarily
  // drop computedBalance/outstandingBalance from the affected account.
  const archiveAccount = async (id: string) => {
    await updateAccount(id, { isArchived: true })
    await fetchAccounts()
  }
  const unarchiveAccount = async (id: string) => {
    await updateAccount(id, { isArchived: false })
    await fetchAccounts()
  }

  const deleteAccount = async (id: string): Promise<void> => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await extractApiError(res))
    setAccounts((prev) => prev.filter((a) => a._id !== id))
  }

  return {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    archiveAccount,
    unarchiveAccount,
    deleteAccount,
    refetch: fetchAccounts,
  }
}
