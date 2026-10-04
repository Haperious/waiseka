'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

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

// Backs every useCategories() call with one shared fetch, instead of each consumer
// (quick-add sheet, transaction/budget forms, settings) hitting /api/categories on mount.
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/categories')
    if (!res.ok) throw new Error(await extractApiError(res))
    return res.json() as Promise<Category[]>
  }, [])

  const { execute, loading, error } = useFetch(fetcher)

  const fetchCategories = useCallback(async () => {
    const data = await execute()
    if (data) setCategories(Array.isArray(data) ? data : [])
  }, [execute])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, loading, error, refetch: fetchCategories }),
    [categories, loading, error, fetchCategories],
  )

  return React.createElement(CategoriesContext.Provider, { value }, children)
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within a CategoriesProvider')
  return ctx
}
