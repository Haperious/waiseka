import { describe, expect, it } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import { authConfig } from '../auth.config'

type JwtParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>['jwt']>>[0]

const runJwt = (params: Partial<JwtParams>) =>
  authConfig.callbacks!.jwt!({ token: {} as JWT, ...params } as JwtParams) as Promise<JWT | null>

const signInUser = (mfaEnabled: boolean) => ({
  id: '64b000000000000000000001',
  role: 'user',
  currency: 'PHP',
  currencySymbol: '₱',
  isAdmin: false,
  tier: 'free',
  premiumOverride: false,
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  mfaEnabled,
})

describe('authConfig jwt callback - MFA flag', () => {
  it('starts an MFA-enabled sign-in unverified', async () => {
    const token = await runJwt({ user: signInUser(true) as JwtParams['user'] })
    expect(token?.mfaVerified).toBe(false)
  })

  it('starts a sign-in without MFA verified', async () => {
    const token = await runJwt({ user: signInUser(false) as JwtParams['user'] })
    expect(token?.mfaVerified).toBe(true)
  })

  it('ignores a client-sent update claiming mfaVerified (the old bypass)', async () => {
    const token = await runJwt({
      token: { id: 'x', mfaVerified: false } as JWT,
      trigger: 'update',
      session: { user: { mfaVerified: true } },
    })
    expect(token?.mfaVerified).toBe(false)
  })

  it('does not verify from an update carrying a ticket either - only auth.ts may, after a DB check', async () => {
    const token = await runJwt({
      token: { id: 'x', mfaVerified: false } as JWT,
      trigger: 'update',
      session: { mfaTicket: 'anything' },
    })
    expect(token?.mfaVerified).toBe(false)
  })
})
