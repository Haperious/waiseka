'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Category {
  _id: string
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories')
      if (res.ok) setCategories(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  return { categories, loading, refetch: fetchCategories }
}
