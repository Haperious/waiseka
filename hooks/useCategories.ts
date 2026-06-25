'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetch, extractApiError } from '@/hooks/useFetch'

export interface Category {
  _id: string
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
}

export function useCategories() {
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

  return { categories, loading, error, refetch: fetchCategories }
}
