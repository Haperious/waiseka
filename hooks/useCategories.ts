'use client'

import React, { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useResource, extractApiError } from '@/hooks/useFetch'

export interface Category {
  _id: string
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
}

interface CategoriesContextValue {
  categories: Category[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

const NO_CATEGORIES: Category[] = []

// Backs every useCategories() call with one shared fetch, instead of each consumer
// (quick-add sheet, transaction/budget forms, settings) hitting /api/categories on mount.
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const fetcher = useCallback(async () => {
    const res = await fetch('/api/categories')
    if (!res.ok) throw new Error(await extractApiError(res))
    const data: unknown = await res.json()
    return (Array.isArray(data) ? data : []) as Category[]
  }, [])

  const { data, loading, error, refetch } = useResource(fetcher)
  const categories = data ?? NO_CATEGORIES

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, loading, error, refetch }),
    [categories, loading, error, refetch],
  )

  return React.createElement(CategoriesContext.Provider, { value }, children)
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within a CategoriesProvider')
  return ctx
}
