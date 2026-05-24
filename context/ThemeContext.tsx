'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

function applyTheme(t: Theme) {
  const html = document.documentElement
  html.classList.remove('light', 'dark')
  html.classList.add(t)
  localStorage.setItem('theme', t)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const local = localStorage.getItem('theme') as Theme | null
    if (local === 'light' || local === 'dark') {
      setThemeState(local)
      applyTheme(local)
    } else {
      applyTheme('dark')
    }

    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        const saved = d?.preferences?.theme as Theme | undefined
        if (saved === 'light' || saved === 'dark') {
          setThemeState(saved)
          applyTheme(saved)
        }
      })
      .catch(() => {})
  }, [])

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: t }),
      })
    } catch {
      /* localStorage is the fallback */
    }
  }, [])

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
