import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
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
  providers: [],
  session: { strategy: 'jwt' },
}
