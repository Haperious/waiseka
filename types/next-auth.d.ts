import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      currency: string
      currencySymbol: string
      isAdmin: boolean
      tier: string
      premiumOverride: boolean
      isVerified: boolean
      createdAt: string
      /** False while an MFA-enabled account has signed in but not yet completed the TOTP step. */
      mfaVerified: boolean
    }
    /**
     * Write-only: sent to `unstable_update()` by /api/auth/mfa/validate-session and
     * consumed in the jwt callback (see lib/mfa-ticket.ts). Never present on a read session.
     */
    mfaTicket?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    currency: string
    currencySymbol: string
    isAdmin: boolean
    tier: string
    premiumOverride: boolean
    isVerified: boolean
    createdAt: string
    mfaVerified: boolean
  }
}
