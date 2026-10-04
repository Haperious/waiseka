"use client"

import { useCallback } from "react"
import { useResource, extractApiError } from "@/hooks/useFetch"

export interface Goal {
  _id: string
  userId: string
  title: string
  targetAmount: number
  savedAmount: number
  deadline: string
  priority: "low" | "medium" | "high"
  status: "active" | "completed" | "paused"
  createdAt: string
}

const NO_GOALS: Goal[] = []

export function useGoals() {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/goals")
    if (!res.ok) throw new Error(await extractApiError(res))
    const data: unknown = await res.json()
    return (Array.isArray(data) ? data : []) as Goal[]
  }, [])

  const { data, loading, error, refetch, mutate } = useResource(fetcher)
  const goals = data ?? NO_GOALS
  // Local list update after a write - wraps mutate so the handlers below read like setState
  const setGoals = useCallback(
    (update: (goals: Goal[]) => Goal[]) => mutate((prev) => update(prev ?? [])),
    [mutate],
  )

  const createGoal = async (
    data: Omit<Goal, "_id" | "userId" | "savedAmount" | "status" | "createdAt">,
  ): Promise<Goal> => {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Goal = await res.json()
    setGoals((prev) => [created, ...prev])
    return created
  }

  const updateGoal = async (id: string, data: Partial<Goal>): Promise<Goal> => {
    const res = await fetch(`/api/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Goal = await res.json()
    setGoals((prev) => prev.map((g) => (g._id === id ? updated : g)))
    return updated
  }

  const deleteGoal = async (id: string): Promise<void> => {
    const res = await fetch(`/api/goals/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error(await extractApiError(res))
    setGoals((prev) => prev.filter((g) => g._id !== id))
  }

  /**
   * Add funds via server-side atomic $inc - avoids client-side race conditions
   * where two concurrent calls could both read the same savedAmount.
   */
  const addFunds = async (id: string, amount: number): Promise<Goal> => {
    const res = await fetch(`/api/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addAmount: amount }),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Goal = await res.json()
    setGoals((prev) => prev.map((g) => (g._id === id ? updated : g)))
    return updated
  }

  return { goals, loading, error, createGoal, updateGoal, deleteGoal, addFunds, refetch }
}
