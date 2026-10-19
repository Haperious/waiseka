'use client'

import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}

/**
 * A browser-only value that doesn't change after load (feature detection, user agent).
 * Renders `serverValue` during SSR and hydration, then `getValue()`. `getValue` must
 * return a primitive (or otherwise stable) value.
 */
export function useClientValue<T>(getValue: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNever, getValue, () => serverValue)
}
