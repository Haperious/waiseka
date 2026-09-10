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
