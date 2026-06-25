'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

export interface Goal {
  _id: string
  userId: string
  title: string
  targetAmount: number
  savedAmount: number
  deadline: string
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused'
  createdAt: string
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/goals')
    if (!res.ok) throw new Error(await extractApiError(res))
    return res.json() as Promise<Goal[]>
  }, [])

  const { execute, loading, error } = useFetch(fetcher)

  const fetchGoals = useCallback(async () => {
    const data = await execute()
    if (data) setGoals(Array.isArray(data) ? data : [])
  }, [execute])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const createGoal = async (data: Omit<Goal, '_id' | 'userId' | 'savedAmount' | 'status' | 'createdAt'>): Promise<Goal> => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Goal = await res.json()
    setGoals((prev) => [created, ...prev])
    return created
  }

  const updateGoal = async (id: string, data: Partial<Goal>): Promise<Goal> => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Goal = await res.json()
    setGoals((prev) => prev.map((g) => (g._id === id ? updated : g)))
    return updated
  }

  const deleteGoal = async (id: string): Promise<void> => {
    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await extractApiError(res))
    setGoals((prev) => prev.filter((g) => g._id !== id))
  }

  /**
   * Add funds via server-side atomic $inc — avoids client-side race conditions
   * where two concurrent calls could both read the same savedAmount.
   */
  const addFunds = async (id: string, amount: number): Promise<Goal> => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addAmount: amount }),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Goal = await res.json()
    setGoals((prev) => prev.map((g) => (g._id === id ? updated : g)))
    return updated
  }

  return { goals, loading, error, createGoal, updateGoal, deleteGoal, addFunds, refetch: fetchGoals }
}
