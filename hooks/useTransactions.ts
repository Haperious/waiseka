'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

export interface Transaction {
  _id: string
  userId: string
  amount: number
  type: 'income' | 'expense' | 'savings'
  category: string
  description?: string
  date: string
  tags: string[]
  isRecurring: boolean
  createdAt: string
}

interface Filters {
  type?: string
  category?: string
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  limit?: number
}

export function useTransactions(filters: Filters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.type) params.set('type', filters.type)
    if (filters.category) params.set('category', filters.category)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.search) params.set('search', filters.search)
    params.set('page', String(filters.page ?? 1))
    params.set('limit', String(filters.limit ?? 20))

    const res = await fetch(`/api/transactions?${params}`)
    if (!res.ok) throw new Error(await extractApiError(res))
    return res.json() as Promise<{ transactions: Transaction[]; total: number; totalPages: number }>
  }, [filters.type, filters.category, filters.startDate, filters.endDate, filters.search, filters.page, filters.limit])

  const { execute, loading, error } = useFetch(fetcher)

  const fetchTransactions = useCallback(async () => {
    const data = await execute()
    if (data) {
      setTransactions(data.transactions ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    }
  }, [execute])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const createTransaction = async (data: Omit<Transaction, '_id' | 'userId' | 'createdAt'>): Promise<Transaction> => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Transaction = await res.json()
    // Optimistic prepend — avoids a full refetch on create
    setTransactions((prev) => [created, ...prev])
    setTotal((prev) => prev + 1)
    return created
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>): Promise<Transaction> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Transaction = await res.json()
    setTransactions((prev) => prev.map((t) => (t._id === id ? updated : t)))
    return updated
  }

  const deleteTransaction = async (id: string): Promise<void> => {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await extractApiError(res))
    setTransactions((prev) => prev.filter((t) => t._id !== id))
    setTotal((prev) => prev - 1)
  }

  return { transactions, total, totalPages, loading, error, createTransaction, updateTransaction, deleteTransaction, refetch: fetchTransactions }
}
