'use client'

import { useState, useEffect, useCallback } from 'react'

export interface VoiceKeyword {
  keyword: string
  category: string
  type?: 'income' | 'expense' | 'savings'
}

const STORAGE_KEY = 'waiseka:voiceKeywords'

export function useVoiceKeywords() {
  const [keywords, setKeywords] = useState<VoiceKeyword[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setKeywords(JSON.parse(stored))
    } catch {
      // ignore parse errors
    }
  }, [])

  const addKeyword = useCallback((keyword: string, category: string, type?: 'income' | 'expense' | 'savings') => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return
    setKeywords((prev) => {
      const filtered = prev.filter((k) => k.keyword.toLowerCase() !== trimmed)
      const updated = [...filtered, { keyword: trimmed, category, ...(type && { type }) }]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const removeKeyword = useCallback((keyword: string) => {
    setKeywords((prev) => {
      const updated = prev.filter((k) => k.keyword.toLowerCase() !== keyword.toLowerCase())
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  return { keywords, addKeyword, removeKeyword }
}
