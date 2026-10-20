import { ObjectId, type Db } from 'mongodb'
import type { NextRequest } from 'next/server'
import type { CurrencyCode } from '@/lib/currency'
import type { IUser } from '@/lib/models/User'
import { isPremium } from '@/lib/tier'
import { currencyScope, viewCurrencyOf } from '@/lib/services/currencyScope'

export interface ReportViewer {
  premium: boolean
  currency: CurrencyCode
  primary: CurrencyCode
  scope: Record<string, unknown>
}

/**
 * For the report routes: the user's tier (read from the database, never the client) and
 * the request's view currency with its scope clause, from a single user lookup.
 */
export async function getReportViewer(db: Db, userId: string, req: NextRequest): Promise<ReportViewer> {
  const user = await db
    .collection<IUser>('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { tier: 1, premiumOverride: 1, preferences: 1 } })
  const premium = user ? isPremium(user) : false
  const { currency, primary } = viewCurrencyOf(user, req.nextUrl.searchParams)
  return { premium, currency, primary, scope: currencyScope(currency, primary) }
}

export const PREMIUM_REPORT_ERROR = 'Full-year and year-on-year reports are part of Premium'
