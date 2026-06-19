import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params)
      if (!token) return null

      // Subsequent requests: verify the password hasn't changed since this token was issued
      // Also refresh lastLogin so the admin panel reflects active sessions
      if (!params.user && token.id) {
        try {
          const db = await getDb()
          const dbUser = await db
            .collection<IUser>('users')
            .findOne({ _id: new ObjectId(token.id as string) }, { projection: { passwordChangedAt: 1 } })

          const dbChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null
          const tokenChangedAt = (token.passwordChangedAt as number | null) ?? null

          if (dbChangedAt && dbChangedAt !== tokenChangedAt) {
            return null
          }

          // Update lastLogin on each active session refresh (throttled to once per hour to
          // avoid excessive writes — we only care about day-level accuracy in the admin panel)
          const lastSeenHour = (token.lastSeenHour as number | undefined) ?? 0
          const currentHour = Math.floor(Date.now() / 3_600_000)
          if (currentHour > lastSeenHour) {
            await db.collection<IUser>('users').updateOne(
              { _id: new ObjectId(token.id as string) },
              { $set: { lastLogin: new Date() } }
            )
            token.lastSeenHour = currentHour
          }
        } catch {
          // If the DB check fails, let the request through rather than locking everyone out
        }
      }

      return token
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }
        if (!email || !password) return null

        const db = await getDb()
        const user = await db.collection<IUser>('users').findOne({ email: email.toLowerCase() })
        if (!user) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        await db.collection<IUser>('users').updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date() } }
        )

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          currency: user.preferences.currency,
          currencySymbol: user.preferences.currencySymbol,
          isAdmin: user.isAdmin,
          tier: user.tier,
          premiumOverride: user.premiumOverride,
          isVerified: user.isVerified,
        }
      },
    }),
  ],
})
