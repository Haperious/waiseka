'use client'

import { useEffect, useState } from 'react'

export interface SimilarEntry {
  _id: string
  date: string
  amount: number
  description: string
  category: string
}

export interface SimilarQuery {
  type: 'income' | 'expense' | 'savings' | 'transfer'
  amount: number
  /** yyyy-MM-dd */
  date: string
  /** Non-transfers: an account id, or '' for unassigned. */
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  /** The entry being edited, so it doesn't match itself. */
  excludeId?: string
}

const DEBOUNCE_MS = 400

/**
 * Entries that look like the one being typed (same type, amount, account, within a day),
 * for a soft "already logged?" warning. Pass null while the form isn't filled enough.
 * Waits for typing to settle; failures just mean no warning.
 */
export function useSimilarEntries(query: SimilarQuery | null): SimilarEntry[] {
  const key = query ? JSON.stringify(query) : ''
  const [result, setResult] = useState<{ key: string; matches: SimilarEntry[] }>({ key: '', matches: [] })

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const q = JSON.parse(key) as SimilarQuery
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(q)) if (v !== undefined) params.set(k, String(v))
      fetch(`/api/transactions/similar?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setResult({ key, matches: Array.isArray(data?.matches) ? data.matches : [] }))
        .catch(() => {})
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key])

  // Only answers for the current query count, so a stale warning never lingers
  return result.key === key && key ? result.matches : []
}
