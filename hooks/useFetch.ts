'use client'

import { useState, useCallback } from 'react'

/**
 * Thin wrapper that standardises the loading/error lifecycle around an async
 * data-fetching function.  Each hook that fetches from the API wraps its
 * fetch call with this so the pattern isn't copy-pasted everywhere.
 *
 * @param fetcher - async function that performs the fetch and returns data
 * @returns       - { data, loading, error, execute }
 *
 * Usage:
 *   const { execute, loading, error } = useFetch(async () => {
 *     const res = await fetch('/api/goals')
 *     if (!res.ok) throw new Error(await extractApiError(res))
 *     return res.json()
 *   })
 */
export function useFetch<T>(fetcher: () => Promise<T>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  return { execute, loading, error, setError }
}

/**
 * Extract a human-readable error message from a failed API response.
 * Prefers the JSON `error` field; falls back to the HTTP status text.
 */
export async function extractApiError(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // body wasn't JSON — fall through
  }
  return `Request failed: ${res.status} ${res.statusText}`
}
