'use client'

import { createContext, useContext, useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
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
  t: (key) => (translations.en as Record<string, string>)[key as string] ?? (key as string),
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useLocalStorage('waiseka_language')
  const language: Language = saved === 'tl' ? 'tl' : 'en'

  const setLanguage = useCallback((lang: Language) => setSaved(lang), [setSaved])

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
