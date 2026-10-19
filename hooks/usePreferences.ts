'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { extractApiError } from '@/hooks/useFetch'
import type { CurrencyCode } from '@/lib/currency'

export interface Preferences {
  currency: CurrencyCode
  currencySymbol: string
  theme?: 'light' | 'dark'
  defaultAccountId?: string | null
  transactionsHiddenAccountIds?: string[]
  transactionsAccountStripCollapsed?: boolean
  cutoffMode?: 'semi-monthly' | 'monthly' | 'custom'
  cutoffDays?: number[]
  cutoffAnchorDate?: string
  /**
   * Per-currency cutoff schedules; a currency without an entry uses cutoffMode/cutoffDays.
   * In an update patch, null removes a currency's own schedule (merged key by key server-side).
   */
  cutoffByCurrency?: Partial<Record<CurrencyCode, { mode: 'semi-monthly' | 'monthly' | 'custom'; days: number[] } | null>>
  reportsDefaultView?: 'chart' | 'table'
  voiceKeywords?: { keyword: string; category: string; type?: 'income' | 'expense' | 'savings' }[]
}

interface PreferencesContextValue {
  preferences: Preferences | null
  loading: boolean
  /** Optimistically applies `patch`, PUTs it, and rolls back (then rethrows) on failure. */
  update: (patch: Partial<Preferences>) => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

// Backs every usePreferences()/useVoiceKeywords() call with one shared fetch, instead of
// each consumer (quick-add sheet, command palette, forms, pages) hitting /api/preferences
// on mount.
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  // Latest value for update()'s rollback and for back-to-back patches in the same tick.
  const preferencesRef = useRef<Preferences | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/preferences')
      .then(async (res) => {
        if (!res.ok) throw new Error(await extractApiError(res))
        return res.json() as Promise<Preferences>
      })
      .then((data) => {
        if (cancelled) return
        preferencesRef.current = data
        setPreferences(data)
      })
      .catch((err) => console.error('[preferences] load failed:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const update = useCallback(async (patch: Partial<Preferences>) => {
    const prev = preferencesRef.current
    const optimistic = prev ? { ...prev, ...patch } : prev
    preferencesRef.current = optimistic
    setPreferences(optimistic)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await extractApiError(res))
      const updated: Preferences = await res.json()
      preferencesRef.current = updated
      setPreferences(updated)
    } catch (err) {
      preferencesRef.current = prev
      setPreferences(prev)
      throw err
    }
  }, [])

  const value = useMemo(() => ({ preferences, loading, update }), [preferences, loading, update])

  return React.createElement(PreferencesContext.Provider, { value }, children)
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
