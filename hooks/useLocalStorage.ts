'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Same-tab writes don't fire the `storage` event, so setters notify these directly.
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * A localStorage entry as React state, shared by every component using the same key
 * and kept in sync across tabs. Reads `null` during SSR and hydration.
 * Passing `null` to the setter removes the entry.
 */
export function useLocalStorage(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null)

  const setValue = useCallback((next: string | null) => {
    try {
      if (next === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, next)
    } catch {
      // storage unavailable (private mode, quota) - nothing to persist
    }
    listeners.forEach((l) => l())
  }, [key])

  return [value, setValue]
}
