'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { extractApiError } from '@/hooks/useFetch'

export interface Preferences {
  currency: 'PHP' | 'QAR' | 'USD'
  currencySymbol: string
  theme?: 'light' | 'dark'
  defaultAccountId?: string | null
  transactionsHiddenAccountIds?: string[]
  transactionsAccountStripCollapsed?: boolean
  cutoffMode?: 'semi-monthly' | 'monthly' | 'custom'
  cutoffDays?: number[]
  cutoffAnchorDate?: string
  reportsDefaultView?: 'chart' | 'table'
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const preferencesRef = useRef<Preferences | null>(null)
  preferencesRef.current = preferences

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/preferences')
        if (!res.ok) throw new Error(await extractApiError(res))
        const data: Preferences = await res.json()
        if (!cancelled) setPreferences(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(async (patch: Partial<Preferences>) => {
    const prev = preferencesRef.current
    setPreferences((p) => (p ? { ...p, ...patch } : p))
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await extractApiError(res))
      const updated: Preferences = await res.json()
      setPreferences(updated)
    } catch (err) {
      setPreferences(prev)
      throw err
    }
  }, [])

  return { preferences, loading, update }
}
