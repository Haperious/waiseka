import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import type { IUser } from '@/lib/models/User'

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          id: string
          role: string
          currency: string
          currencySymbol: string
          isAdmin: boolean
          tier: string
          premiumOverride: boolean
        }
        token.id = u.id
        token.role = u.role
        token.currency = u.currency
        token.currencySymbol = u.currencySymbol
        token.isAdmin = u.isAdmin
        token.tier = u.tier
        token.premiumOverride = u.premiumOverride
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
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
})
