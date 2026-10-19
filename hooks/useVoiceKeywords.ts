'use client'

import { useEffect, useCallback, useMemo, useRef } from 'react'
import { usePreferences } from '@/hooks/usePreferences'

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

const EMPTY: VoiceKeyword[] = []

export function useVoiceKeywords() {
  const { preferences, update } = usePreferences()
  const keywords = useMemo(() => preferences?.voiceKeywords ?? EMPTY, [preferences])
  // Latest list, so back-to-back add/remove calls build on each other
  const keywordsRef = useRef(keywords)

  useEffect(() => {
    keywordsRef.current = keywords
  }, [keywords])

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {}
  }, [])

  const save = useCallback((updated: VoiceKeyword[]) => {
    keywordsRef.current = updated
    update({ voiceKeywords: updated }).catch(() => {
      // update() already rolled the shared preferences back
    })
  }, [update])

  const addKeyword = useCallback((keyword: string, category: string, type?: 'income' | 'expense' | 'savings') => {
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return
    const filtered = keywordsRef.current.filter((k) => k.keyword.toLowerCase() !== trimmed)
    save([...filtered, { keyword: trimmed, category, ...(type && { type }) }])
  }, [save])

  const removeKeyword = useCallback((keyword: string) => {
    save(keywordsRef.current.filter((k) => k.keyword.toLowerCase() !== keyword.toLowerCase()))
  }, [save])

  return { keywords, addKeyword, removeKeyword }
}
