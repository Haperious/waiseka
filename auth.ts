import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          passwordChangedAt: user.passwordChangedAt ?? null,
        }
      },
    }),
  ],
})
