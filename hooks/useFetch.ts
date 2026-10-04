"use client"

import { useState, useCallback, useEffect, useRef } from "react"

interface Snapshot<T> {
  /** The fetcher that produced `data`/`error` - compared against the current one to derive `loading`. */
  source: (() => Promise<T>) | null
  data: T | undefined
  error: string | null
}

export interface ResourceOptions {
  /** When false, nothing is fetched and `loading` is false. Default true. */
  enabled?: boolean
  /** Called with the error message whenever a fetch fails (e.g. to show a toast). */
  onError?: (message: string) => void
}

/**
 * Fetches `fetcher()` whenever it changes (memoize it with useCallback - its deps are
 * the request's inputs) and keeps the result. A response that arrives after the inputs
 * changed again is ignored, so a slow request can't overwrite a newer one.
 *
 * - `loading` is true until data for the *current* fetcher has arrived, and during `refetch()`.
 *   Previous data stays in `data` meanwhile, so lists don't blank out on filter changes.
 * - `refetch()` re-runs the current fetcher (for event handlers - after a save, a retry button).
 * - `mutate()` updates `data` locally, for optimistic updates after a write.
 *
 * Usage:
 *   const fetcher = useCallback(async () => {
 *     const res = await fetch(`/api/goals?page=${page}`)
 *     if (!res.ok) throw new Error(await extractApiError(res))
 *     return res.json() as Promise<Goal[]>
 *   }, [page])
 *   const { data, loading, error, refetch, mutate } = useResource(fetcher)
 */
export function useResource<T>(fetcher: () => Promise<T>, options: ResourceOptions = {}) {
  const { enabled = true } = options
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ source: null, data: undefined, error: null })
  const [refreshing, setRefreshing] = useState(false)

  const onErrorRef = useRef(options.onError)
  useEffect(() => {
    onErrorRef.current = options.onError
  })

  const settle = useCallback((source: () => Promise<T>, outcome: { data: T } | { error: unknown }) => {
    if ("data" in outcome) {
      setSnapshot({ source, data: outcome.data, error: null })
      return
    }
    const message = outcome.error instanceof Error ? outcome.error.message : "An unexpected error occurred"
    setSnapshot((prev) => ({ source, data: prev.data, error: message }))
    onErrorRef.current?.(message)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetcher().then(
      (data) => { if (!cancelled) settle(fetcher, { data }) },
      (error: unknown) => { if (!cancelled) settle(fetcher, { error }) },
    )
    return () => { cancelled = true }
  }, [fetcher, enabled, settle])

  const refetch = useCallback(async () => {
    setRefreshing(true)
    try {
      settle(fetcher, { data: await fetcher() })
    } catch (error) {
      settle(fetcher, { error })
    } finally {
      setRefreshing(false)
    }
  }, [fetcher, settle])

  const mutate = useCallback((update: (prev: T | undefined) => T | undefined) => {
    setSnapshot((prev) => ({ ...prev, data: update(prev.data) }))
  }, [])

  return {
    data: snapshot.data,
    loading: enabled && (snapshot.source !== fetcher || refreshing),
    error: snapshot.error,
    refetch,
    mutate,
  }
}

/**
 * Extract a human-readable error message from a failed API response.
 * Prefers the JSON `error` field; falls back to the HTTP status text.
 */
export async function extractApiError(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    if (typeof body?.error === "string") return body.error
  } catch {
    // body wasn't JSON - fall through
  }
  return `Request failed: ${res.status} ${res.statusText}`
}
