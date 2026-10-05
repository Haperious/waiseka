import { ObjectId, type Db } from 'mongodb'
import type { NextRequest } from 'next/server'
import type { CurrencyCode } from '@/lib/currency'
import type { IUser } from '@/lib/models/User'
import { currencyScope, viewCurrencyOf } from '@/lib/services/currencyScope'

/**
 * For routes that don't otherwise load the user: reads ?currency= and returns the
 * resolved view currency, the user's primary, and the matching scope clause.
 */
export async function getRequestCurrencyScope(db: Db, userId: string, req: NextRequest): Promise<{
  currency: CurrencyCode
  primary: CurrencyCode
  scope: Record<string, unknown>
}> {
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(userId) as never }, { projection: { preferences: 1 } })
  const { currency, primary } = viewCurrencyOf(user, req.nextUrl.searchParams)
  return { currency, primary, scope: currencyScope(currency, primary) }
}
