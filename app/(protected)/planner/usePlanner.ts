'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { extractApiError, useResource } from '@/hooks/useFetch'
import { localToday } from '@/lib/planner/days'
import type { PlannerContext, PlannerListResponse, PlannerScenario } from '@/lib/planner/types'

export type EditableFields = Pick<PlannerScenario, 'name' | 'accountIds' | 'endDate' | 'items'>
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 700

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await extractApiError(res))
  return res.json() as Promise<T>
}

/** The list of saved plans. */
export function usePlannerList() {
  const fetcher = useCallback(() => fetch('/api/planner/scenarios').then((r) => readJson<PlannerListResponse>(r)), [])
  return useResource(fetcher)
}

/**
 * One plan, editable. Edits apply locally at once (the projection re-runs instantly) and
 * are saved shortly after - only the fields that changed, so an old plan whose end date has
 * passed can still be renamed. The live figures (context) reload when the end date changes
 * or `reloadContext()` is called, e.g. after logging a real transaction.
 *
 * Everything is kept per plan id, so switching plans shows the new one's state at once
 * and a late response for the old plan is simply ignored.
 */
export function usePlannerScenario(id: string | null, onSaved?: (s: PlannerScenario) => void) {
  const [loaded, setLoaded] = useState<{ id: string; draft: PlannerScenario; context: PlannerContext } | null>(null)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)
  const [save, setSave] = useState<{ id: string; state: SaveState; error: string | null } | null>(null)

  const draftRef = useRef<PlannerScenario | null>(null)
  const dirty = useRef(new Set<keyof EditableFields>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  })

  const load = useCallback(async (scenarioId: string) => {
    const res = await fetch(`/api/planner/scenarios/${scenarioId}?today=${localToday()}`)
    return readJson<{ scenario: PlannerScenario; context: PlannerContext }>(res)
  }, [])

  const setContextFor = useCallback((scenarioId: string, context: PlannerContext) => {
    setLoaded((prev) => (prev && prev.id === scenarioId ? { ...prev, context } : prev))
  }, [])

  // Saves run one at a time, in order, so an older save can never land after a newer one
  const queue = useRef<Promise<void>>(Promise.resolve())
  const queued = useRef(0)

  const send = useCallback(async (snapshot: PlannerScenario, fields: (keyof EditableFields)[], keepalive: boolean) => {
    const scenarioId = snapshot._id
    const body: Record<string, unknown> = { today: localToday() }
    for (const f of fields) body[f] = snapshot[f]
    try {
      const res = await fetch(`/api/planner/scenarios/${scenarioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
      })
      const { scenario } = await readJson<{ scenario: PlannerScenario }>(res)
      const stillOpen = draftRef.current?._id === scenarioId
      const newerPending = dirty.current.size > 0 || queued.current > 1
      // Nothing newer typed or queued: take the server's tidied copy (dropped accounts, trimmed text)
      if (stillOpen && !newerPending) {
        draftRef.current = scenario
        setLoaded((prev) => (prev && prev.id === scenarioId ? { ...prev, draft: scenario } : prev))
      }
      setSave({ id: scenarioId, state: stillOpen && newerPending ? 'saving' : 'saved', error: null })
      onSavedRef.current?.(scenario)
      if (fields.includes('endDate') && stillOpen) {
        const fresh = await load(scenarioId)
        setContextFor(scenarioId, fresh.context)
      }
    } catch (err) {
      // Keep the edits (if the plan is still open) so "Try again" resends them
      if (draftRef.current?._id === scenarioId) for (const f of fields) dirty.current.add(f)
      setSave({ id: scenarioId, state: 'error', error: err instanceof Error ? err.message : 'Could not save' })
    }
  }, [load, setContextFor])

  /**
   * Saves whatever changed. The plan and the changed fields are taken right away, so a
   * plan switch straight after still saves the right plan. `keepalive` lets the request
   * finish while the page is closing.
   */
  const flush = useCallback(({ keepalive = false } = {}): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const snapshot = draftRef.current
    if (!snapshot || dirty.current.size === 0) return queue.current
    const fields = [...dirty.current]
    dirty.current.clear()
    setSave({ id: snapshot._id, state: 'saving', error: null })
    queued.current++
    const run = queue.current.then(() => send(snapshot, fields, keepalive)).finally(() => { queued.current-- })
    queue.current = run
    return run
  }, [send])

  // Load whenever the selected plan changes; leaving a plan saves its pending edits first
  useEffect(() => {
    let cancelled = false
    if (id) {
      load(id).then(
        ({ scenario, context }) => {
          if (cancelled) return
          draftRef.current = scenario
          setLoaded({ id, draft: scenario, context })
        },
        (err: unknown) => {
          if (!cancelled) setFailed({ id, message: err instanceof Error ? err.message : 'Could not load the plan' })
        },
      )
    }
    return () => {
      cancelled = true
      // flush() takes the pending fields synchronously, so the next plan starts clean
      void flush()
      draftRef.current = null
    }
  }, [id, load, flush])

  // Don't lose the last edit when the tab closes
  useEffect(() => {
    const onHide = () => { if (dirty.current.size > 0) void flush({ keepalive: true }) }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flush])

  const update = useCallback((patch: Partial<EditableFields>) => {
    const current = draftRef.current
    if (!current) return
    const next = { ...current, ...patch }
    draftRef.current = next
    setLoaded((prev) => (prev && prev.id === next._id ? { ...prev, draft: next } : prev))
    for (const k of Object.keys(patch) as (keyof EditableFields)[]) dirty.current.add(k)
    setSave({ id: next._id, state: 'saving', error: null })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }, [flush])

  const reloadContext = useCallback(async () => {
    const current = draftRef.current
    if (!current) return
    try {
      const fresh = await load(current._id)
      setContextFor(current._id, fresh.context)
    } catch {
      // Keeps the figures already shown
    }
  }, [load, setContextFor])

  const mine = loaded && loaded.id === id ? loaded : null
  const saveMine = save && save.id === id ? save : null
  return {
    draft: mine?.draft ?? null,
    context: mine?.context ?? null,
    loadError: failed && failed.id === id && !mine ? failed.message : null,
    saveState: saveMine?.state ?? 'idle',
    saveError: saveMine?.error ?? null,
    update,
    flush,
    reloadContext,
  }
}
