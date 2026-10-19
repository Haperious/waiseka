'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Live `window.matchMedia(query).matches`. Renders `serverValue` during SSR and
 * hydration, then the real value - same timing as reading it in a mount effect,
 * without the extra setState pass.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
