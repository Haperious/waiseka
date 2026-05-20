'use client'

import { useState, useEffect, useCallback } from 'react'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets')
      const data = await res.json()
      setBudgets(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

  const createBudget = async (data: Omit<Budget, '_id' | 'userId' | 'spent' | 'createdAt'>) => {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create budget')
    await fetchBudgets()
  }

  const updateBudget = async (id: string, data: Partial<Budget>) => {
    const res = await fetch(`/api/budgets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update budget')
    await fetchBudgets()
  }

  const deleteBudget = async (id: string) => {
    const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete budget')
    await fetchBudgets()
  }

  return { budgets, loading, error, createBudget, updateBudget, deleteBudget, refetch: fetchBudgets }
}
