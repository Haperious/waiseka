'use client'

import { createContext, useContext, useEffect, useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // localStorage is the fast local copy; the account preference (fetched below) wins once loaded
  const [stored, setStored] = useLocalStorage('theme')
  const theme: Theme = stored === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('light', 'dark')
    html.classList.add(theme)
  }, [theme])

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        const saved = d?.preferences?.theme as Theme | undefined
        if (saved === 'light' || saved === 'dark') setStored(saved)
      })
      .catch(() => {})
  }, [setStored])

  const setTheme = useCallback(async (t: Theme) => {
    setStored(t)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: t }),
      })
    } catch {
      /* localStorage is the fallback */
    }
  }, [setStored])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
