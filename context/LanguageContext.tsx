'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translations, TranslationKey } from '@/lib/translations'

export type Language = 'en' | 'tl'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key as string,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('waiseka_language') as Language | null
    if (saved === 'en' || saved === 'tl') {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('waiseka_language', lang)
  }, [])

  const t = useCallback(
    (key: TranslationKey): string =>
      (translations[language] as Record<string, string>)[key as string] ?? (key as string),
    [language],
  )

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
