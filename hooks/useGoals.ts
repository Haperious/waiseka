'use client'

import { useState, useEffect, useCallback } from 'react'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/goals')
      const data = await res.json()
      setGoals(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const createGoal = async (data: Omit<Goal, '_id' | 'userId' | 'savedAmount' | 'status' | 'createdAt'>) => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create goal')
    await fetchGoals()
  }

  const updateGoal = async (id: string, data: Partial<Goal>) => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update goal')
    await fetchGoals()
  }

  const deleteGoal = async (id: string) => {
    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete goal')
    await fetchGoals()
  }

  const addFunds = async (id: string, amount: number) => {
    const goal = goals.find((g) => g._id === id)
    if (!goal) throw new Error('Goal not found')
    const newSaved = goal.savedAmount + amount
    const newStatus = newSaved >= goal.targetAmount ? 'completed' : goal.status
    await updateGoal(id, { savedAmount: newSaved, status: newStatus })
  }

  return { goals, loading, error, createGoal, updateGoal, deleteGoal, addFunds, refetch: fetchGoals }
}
