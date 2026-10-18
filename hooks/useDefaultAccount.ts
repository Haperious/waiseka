'use client'

import { useMemo } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences } from '@/hooks/usePreferences'

/**
 * The account new transactions pre-fill with: the saved default account, else the
 * first active debit account, else unassigned ('').
 *
 * `ready` is false until both accounts and preferences have loaded. Until then, forms
 * should leave `accountId` out of the request body so the server applies the same
 * default instead of saving as unassigned. See accountIdForSubmit (lib/accountSelection.ts)
 * and resolveDefaultAccount (lib/services/defaultAccount.ts).
 */
export function useDefaultAccount() {
  const { accounts, loading: accountsLoading } = useAccounts()
  const { preferences, loading: prefsLoading } = usePreferences()
  const ready = !accountsLoading && !prefsLoading

  const defaultAccountId = useMemo(() => {
    if (!ready) return ''
    const active = accounts.filter((a) => !a.isArchived)
    const preferred = preferences?.defaultAccountId
    if (preferred && active.some((a) => a._id === preferred)) return preferred
    return active.find((a) => a.type === 'debit')?._id ?? ''
  }, [ready, accounts, preferences])

  return { defaultAccountId, ready }
}
