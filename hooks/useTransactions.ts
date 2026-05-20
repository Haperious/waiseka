'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Transaction {
  _id: string
  userId: string
  amount: number
  type: 'income' | 'expense'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.type) params.set('type', filters.type)
      if (filters.category) params.set('category', filters.category)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.search) params.set('search', filters.search)
      params.set('page', String(filters.page ?? 1))
      params.set('limit', String(filters.limit ?? 20))

      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setTransactions(data.transactions ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [filters.type, filters.category, filters.startDate, filters.endDate, filters.search, filters.page, filters.limit])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const createTransaction = async (data: Omit<Transaction, '_id' | 'userId' | 'createdAt'>) => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create transaction')
    await fetchTransactions()
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update transaction')
    await fetchTransactions()
  }

  const deleteTransaction = async (id: string) => {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete transaction')
    await fetchTransactions()
  }

  return { transactions, total, totalPages, loading, error, createTransaction, updateTransaction, deleteTransaction, refetch: fetchTransactions }
}
