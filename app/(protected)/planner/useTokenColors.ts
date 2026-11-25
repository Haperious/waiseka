'use client'

import { useSyncExternalStore } from 'react'

const SEP = '|'

function subscribe(onChange: () => void) {
  // The theme is a class on <html>; watch it so colours follow light/dark
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
  return () => observer.disconnect()
}

/**
 * The current values of CSS colour tokens, for SVG attributes (Recharts) that can't take
 * `var(...)`. Re-reads when the theme class on <html> changes. Returns `fallback` until
 * mounted.
 */
export function useTokenColors(names: readonly string[], fallback = 'currentColor'): string[] {
  const key = names.join(SEP)
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const css = getComputedStyle(document.documentElement)
      return key.split(SEP).map((n) => css.getPropertyValue(n).trim() || fallback).join(SEP)
    },
    () => key.split(SEP).map(() => fallback).join(SEP),
  )
  return snapshot.split(SEP)
}
