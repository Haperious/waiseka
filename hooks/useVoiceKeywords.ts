'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface VoiceKeyword {
  keyword: string
  category: string
  type?: 'income' | 'expense' | 'savings'
}

/**
 * Keywords used to live in localStorage under this key, which leaked them to
 * every account signed in on the same browser. They're now stored per-user in
 * preferences; the legacy key is cleared and never read.
 */
const LEGACY_STORAGE_KEY = 'waiseka:voiceKeywords'

export function useVoiceKeywords() {
  const [keywords, setKeywords] = useState<VoiceKeyword[]>([])
  const keywordsRef = useRef<VoiceKeyword[]>([])

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {}

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/preferences')
        if (!res.ok) return
        const data: { voiceKeywords?: VoiceKeyword[] } | null = await res.json()
        if (cancelled) return
        keywordsRef.current = data?.voiceKeywords ?? []
        setKeywords(keywordsRef.current)
      } catch {
        // keep empty list on network errors
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async (updated: VoiceKeyword[]) => {
    const prev = keywordsRef.current
    keywordsRef.current = updated
    setKeywords(updated)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceKeywords: updated }),
      })
      if (!res.ok) throw new Error('Failed to save voice keywords')
    } catch {
      keywordsRef.current = prev
      setKeywords(prev)
    }
  }, [])

  const addKeyword = useCallback((keyword: string, category: string, type?: 'income' | 'expense' | 'savings') => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return
    const filtered = keywordsRef.current.filter((k) => k.keyword.toLowerCase() !== trimmed)
    void save([...filtered, { keyword: trimmed, category, ...(type && { type }) }])
  }, [save])

  const removeKeyword = useCallback((keyword: string) => {
    void save(keywordsRef.current.filter((k) => k.keyword.toLowerCase() !== keyword.toLowerCase()))
  }, [save])

  return { keywords, addKeyword, removeKeyword }
}
