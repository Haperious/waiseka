import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          id: string
          role: string
          currency: string
          currencySymbol: string
          isAdmin: boolean
          tier: string
          premiumOverride: boolean
          isVerified: boolean
          createdAt: string
          mfaEnabled: boolean
          passwordChangedAt: number | null
        }
        token.id = u.id
        token.role = u.role
        token.currency = u.currency
        token.currencySymbol = u.currencySymbol
        token.isAdmin = u.isAdmin
        token.tier = u.tier
        token.premiumOverride = u.premiumOverride
        token.isVerified = u.isVerified
        token.createdAt = u.createdAt
        // auth.ts drops the session once the stored value moves past this one
        token.passwordChangedAt = u.passwordChangedAt ?? null
        // MFA-enabled accounts start every new session unverified. Only the jwt callback
        // in auth.ts flips this to true, after consuming a server-issued MFA ticket -
        // never trust an `update` payload here, the browser can send one too.
        token.mfaVerified = !u.mfaEnabled
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
        session.user.isVerified = token.isVerified as boolean
        session.user.createdAt = token.createdAt as string
        session.user.mfaVerified = token.mfaVerified as boolean
      }
      return session
    },
  },
  providers: [],
  session: {
    strategy: 'jwt',
    // Short-lived on purpose: a leaked cookie should go stale fast. Any active request
    // within updateAge silently re-issues the cookie, so real usage never hits this.
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
}
