'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

export interface Budget {
  _id: string
  userId: string
  category: string
  limit: number
  period: 'monthly' | 'weekly'
  spent: number
  color?: string
  createdAt: string
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/budgets')
    if (!res.ok) throw new Error(await extractApiError(res))
    return res.json() as Promise<Budget[]>
  }, [])

  const { execute, loading, error } = useFetch(fetcher)

  const fetchBudgets = useCallback(async () => {
    const data = await execute()
    if (data) setBudgets(Array.isArray(data) ? data : [])
  }, [execute])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

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

  return { budgets, loading, error, createBudget, updateBudget, deleteBudget, refetch: fetchBudgets }
}
