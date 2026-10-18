import { ObjectId, type Db } from 'mongodb'
import type { IAccount } from '@/lib/models/Account'

/**
 * The account a new transaction lands on when the client didn't pick one: the user's
 * saved default account if it still exists and isn't archived, otherwise their first
 * active debit account (same order as the account dropdown). Null = unassigned.
 *
 * Mirrors the client-side pre-fill in useDefaultAccount, so a form submitted before
 * accounts/preferences finished loading still saves to the same account.
 */
export async function resolveDefaultAccount(
  db: Db,
  userId: string,
  preferredAccountId: string | null | undefined
): Promise<IAccount | null> {
  const accounts = db.collection<IAccount>('accounts')

  if (preferredAccountId && ObjectId.isValid(preferredAccountId)) {
    const preferred = await accounts.findOne({ _id: new ObjectId(preferredAccountId), userId, isArchived: { $ne: true } })
    if (preferred) return preferred
  }

  return accounts.findOne(
    { userId, type: 'debit', isArchived: { $ne: true } },
    { sort: { displayOrder: 1, createdAt: 1 } }
  )
}
