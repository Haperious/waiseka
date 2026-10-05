"use client"

import { useCallback } from "react"
import { useResource, extractApiError } from "@/hooks/useFetch"
import type { CurrencyCode } from "@/lib/currency"

export interface Transaction {
  _id: string
  userId: string
  amount: number
  /** Missing on imports/very old rows - those count as the primary currency. */
  currency?: CurrencyCode | null
  type: "income" | "expense" | "savings" | "transfer"
  category: string
  description?: string
  date: string
  tags: string[]
  isRecurring: boolean
  accountId: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
  createdAt: string
}

interface Filters {
  type?: string
  category?: string
  startDate?: string
  endDate?: string
  search?: string
  accountId?: string
  /** Only set by the view-currency switcher (multi-currency users). Unset = every currency. */
  currency?: string
  page?: number
  limit?: number
}

interface TransactionPage {
  transactions: Transaction[]
  total: number
  totalPages: number
}

const NO_TRANSACTIONS: Transaction[] = []

export function useTransactions(filters: Filters = {}) {
  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.type) params.set("type", filters.type)
    if (filters.category) params.set("category", filters.category)
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.search) params.set("search", filters.search)
    if (filters.accountId) params.set("accountId", filters.accountId)
    if (filters.currency) params.set("currency", filters.currency)
    params.set("page", String(filters.page ?? 1))
    params.set("limit", String(filters.limit ?? 20))

    const res = await fetch(`/api/transactions?${params}`)
    if (!res.ok) throw new Error(await extractApiError(res))
    const data: Partial<TransactionPage> = await res.json()
    return {
      transactions: data.transactions ?? [],
      total: data.total ?? 0,
      totalPages: data.totalPages ?? 1,
    }
  }, [
    filters.type,
    filters.category,
    filters.startDate,
    filters.endDate,
    filters.search,
    filters.accountId,
    filters.currency,
    filters.page,
    filters.limit,
  ])

  const { data, loading, error, refetch, mutate } = useResource(fetcher)
  const transactions = data?.transactions ?? NO_TRANSACTIONS
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  // Local page update after a write
  const updatePage = (update: (page: TransactionPage) => TransactionPage) =>
    mutate((prev) => (prev ? update(prev) : prev))

  const createTransaction = async (data: Omit<Transaction, "_id" | "userId" | "createdAt">): Promise<Transaction> => {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const created: Transaction = await res.json()
    // Optimistic prepend - avoids a full refetch on create
    updatePage((p) => ({ ...p, transactions: [created, ...p.transactions], total: p.total + 1 }))
    return created
  }

  const updateTransaction = async (id: string, data: Partial<Transaction>): Promise<Transaction> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await extractApiError(res))
    const updated: Transaction = await res.json()
    updatePage((p) => ({ ...p, transactions: p.transactions.map((t) => (t._id === id ? updated : t)) }))
    return updated
  }

  const deleteTransaction = async (id: string): Promise<void> => {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error(await extractApiError(res))
    updatePage((p) => ({ ...p, transactions: p.transactions.filter((t) => t._id !== id), total: p.total - 1 }))
  }

  return {
    transactions,
    total,
    totalPages,
    loading,
    error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refetch,
  }
}
