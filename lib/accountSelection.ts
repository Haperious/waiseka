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
