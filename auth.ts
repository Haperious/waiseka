import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import type { IUser } from '@/lib/models/User'
import { checkLoginRateLimit } from '@/lib/auth-rate-limit'
import { getClientIp } from '@/lib/rate-limit'
import { LOGIN_RATE_LIMITED_CODE } from '@/lib/constants'
import { consumeMfaTicket } from '@/lib/mfa-ticket'
import { authConfig } from './auth.config'

/** Surfaces as `code` on the client's signIn() result so the login page can explain the lockout. */
class LoginRateLimitedError extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params)
      if (!token) return null

      // Complete the MFA step. The update payload is client-controllable, so it only
      // carries a ticket; the flag flips only if that ticket is consumed from the DB.
      if (params.trigger === 'update' && token.mfaVerified === false && token.id) {
        const ticket = (params.session as { mfaTicket?: unknown } | undefined)?.mfaTicket
        if (typeof ticket === 'string') {
          try {
            const db = await getDb()
            if (await consumeMfaTicket(db, token.id as string, ticket)) {
              token.mfaVerified = true
            }
          } catch (error) {
            // Fail closed: the session stays unverified and validate-session reports the failure
            console.error('[auth] MFA ticket check failed', error)
          }
        }
      }

      // Subsequent requests: verify the password hasn't changed since this token was issued
      // Also refresh lastLogin so the admin panel reflects active sessions
      if (!params.user && token.id) {
        try {
          const db = await getDb()
          const dbUser = await db
            .collection<IUser>('users')
            .findOne(
              { _id: new ObjectId(token.id as string) },
              { projection: { passwordChangedAt: 1, isVerified: 1 } }
            )

          const dbChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null
          const tokenChangedAt = (token.passwordChangedAt as number | null) ?? null

          if (dbChangedAt && dbChangedAt !== tokenChangedAt) {
            return null
          }

          // isVerified is snapshotted at login, so verifying via the email link (often opened in
          // another tab/browser) would otherwise never reach an already-open session.
          if (dbUser && typeof dbUser.isVerified === 'boolean') {
            token.isVerified = dbUser.isVerified
          }

          // Update lastLogin on each active session refresh (throttled to once per hour to
          // avoid excessive writes - we only care about day-level accuracy in the admin panel)
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
      async authorize(credentials, request) {
        const { email, password } = credentials as { email: string; password: string }
        if (!email || !password) return null

        // Checked before the DB lookup and bcrypt compare so a locked-out
        // attacker gets no timing signal and costs us no hashing work
        const rateLimitResult = checkLoginRateLimit(email, getClientIp(request))
        if (!rateLimitResult.allowed) throw new LoginRateLimitedError()

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
          createdAt: user.createdAt.toISOString(),
          mfaEnabled: !!user.mfa?.enabled,
        }
      },
    }),
  ],
})
