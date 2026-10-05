'use client'

import { useCallback } from 'react'
import { useResource, extractApiError } from '@/hooks/useFetch'

export interface Budget {
  _id: string
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  /** Always filled in by GET /api/budgets (missing in the DB = primary). Only same-currency expenses count. */
  currency?: 'PHP' | 'QAR' | 'USD'
  spent: number
  color?: string
  createdAt: string
}

const NO_BUDGETS: Budget[] = []

export function useBudgets() {
  const fetcher = useCallback(async () => {
    const res = await fetch('/api/budgets')
    if (!res.ok) throw new Error(await extractApiError(res))
    const data: unknown = await res.json()
    return (Array.isArray(data) ? data : []) as Budget[]
  }, [])

  const { data, loading, error, refetch, mutate } = useResource(fetcher)
  const budgets = data ?? NO_BUDGETS
  // Local list update after a write - wraps mutate so the handlers below read like setState
  const setBudgets = useCallback(
    (update: (budgets: Budget[]) => Budget[]) => mutate((prev) => update(prev ?? [])),
    [mutate],
  )

  const createBudget = async (data: Omit<Budget, '_id' | 'userId' | 'spent' | 'createdAt'>): Promise<Budget> => {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Budget = await res.json()
    setBudgets((prev) => [created, ...prev])
    return created
  }

  const updateBudget = async (id: string, data: Partial<Budget>): Promise<Budget> => {
    const res = await fetch(`/api/budgets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Budget = await res.json()
    setBudgets((prev) => prev.map((b) => (b._id === id ? updated : b)))
    return updated
  }

  const deleteBudget = async (id: string): Promise<void> => {
    const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await extractApiError(res))
    setBudgets((prev) => prev.filter((b) => b._id !== id))
  }

  return { budgets, loading, error, createBudget, updateBudget, deleteBudget, refetch }
}
