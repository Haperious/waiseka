/**
 * The `accountId` to send for a new transaction. `chosen` is null while the user
 * hasn't touched the account picker ('' = they picked Unassigned).
 * Returns undefined (omitted from JSON) when the default isn't known yet, letting the
 * server resolve it.
 */
export function accountIdForSubmit(
  chosen: string | null,
  defaultAccountId: string,
  ready: boolean
): string | null | undefined {
  if (chosen !== null) return chosen || null
  if (!ready) return undefined
  return defaultAccountId || null
}

/**
 * The account new transactions pre-fill with: the saved default if it's still active,
 * else the first active debit account (in list order), else '' (unassigned).
 * Mirrors resolveDefaultAccount (lib/services/defaultAccount.ts) on the server.
 */
export function pickDefaultAccountId(
  accounts: readonly { _id: string; type: string; isArchived?: boolean }[],
  preferredAccountId: string | null | undefined
): string {
  const active = accounts.filter((a) => !a.isArchived)
  if (preferredAccountId && active.some((a) => a._id === preferredAccountId)) return preferredAccountId
  return active.find((a) => a.type === 'debit')?._id ?? ''
}
