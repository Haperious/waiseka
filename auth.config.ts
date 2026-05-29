import type { NextAuthConfig } from 'next-auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: embed fields into the token
        const u = user as typeof user & {
          id: string
          role: string
          currency: string
          currencySymbol: string
          isAdmin: boolean
          tier: string
          premiumOverride: boolean
          passwordChangedAt?: Date
        }
        token.id = u.id
        token.role = u.role
        token.currency = u.currency
        token.currencySymbol = u.currencySymbol
        token.isAdmin = u.isAdmin
        token.tier = u.tier
        token.premiumOverride = u.premiumOverride
        token.passwordChangedAt = u.passwordChangedAt?.getTime() ?? null
        return token
      }

      // Subsequent requests: verify the password hasn't changed since this token was issued
      if (token.id) {
        try {
          const db = await getDb()
          const dbUser = await db
            .collection<IUser>('users')
            .findOne({ _id: new ObjectId(token.id as string) }, { projection: { passwordChangedAt: 1 } })

          const dbChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null
          const tokenChangedAt = token.passwordChangedAt as number | null ?? null

          // If DB has a newer passwordChangedAt, this token is stale — invalidate it
          if (dbChangedAt && dbChangedAt !== tokenChangedAt) {
            return null // Returning null forces the session to be destroyed
          }
        } catch {
          // If the DB check fails, let the request through rather than locking everyone out
        }
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.currency = token.currency as string
        session.user.currencySymbol = token.currencySymbol as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.tier = token.tier as string
        session.user.premiumOverride = token.premiumOverride as boolean
      }
      return session
    },
  },
  providers: [],
  session: { strategy: 'jwt' },
}
