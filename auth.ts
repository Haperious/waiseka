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
import { MAX_EMAIL_LENGTH } from '@/lib/request'

// Looser than the 128 a new password may have, so no account set before that cap is locked out
const MAX_SIGN_IN_PASSWORD_LENGTH = 1024
import { authConfig } from './auth.config'

/** Surfaces as `code` on the client's signIn() result so the login page can explain the lockout. */
class LoginRateLimitedError extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE
}

// Compared against when the email has no account, so a miss costs the same bcrypt work as a
// wrong password and response timing doesn't reveal which emails are registered. A cost-12
// hash of random bytes nobody kept - precomputed so it adds nothing to cold starts.
const DUMMY_PASSWORD_HASH = '$2b$12$1GzCOv1bRAGT0aP/lgJGf.7/sRd00X0r1ayb0G2MnvAriL9.JfWGu'

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params)
      if (!token) return null

      // Complete the MFA step (or re-stamp the session that just turned MFA on). The update
      // payload is client-controllable, so it only carries a ticket; nothing changes unless
      // that ticket is consumed from the DB.
      if (params.trigger === 'update' && token.id) {
        const ticket = (params.session as { mfaTicket?: unknown } | undefined)?.mfaTicket
        if (typeof ticket === 'string') {
          try {
            const db = await getDb()
            if (await consumeMfaTicket(db, token.id as string, ticket)) {
              token.mfaVerified = true
              // Survives the sessionsRevokedAt cut-off checked below
              token.authTime = Date.now()
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
              { projection: { passwordChangedAt: 1, sessionsRevokedAt: 1, isVerified: 1, isAdmin: 1, tier: 1, premiumOverride: 1 } }
            )

          const dbChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null
          const tokenChangedAt = (token.passwordChangedAt as number | null) ?? null

          if (dbChangedAt && dbChangedAt !== tokenChangedAt) {
            return null
          }

          // Signed out everywhere (MFA turned on, or reset by an admin). Sessions from
          // before authTime existed count as signed in at 0, so they're cut off too.
          const revokedAt = dbUser?.sessionsRevokedAt?.getTime()
          if (revokedAt && ((token.authTime as number | undefined) ?? 0) < revokedAt) {
            return null
          }

          // isVerified is snapshotted at login, so verifying via the email link (often opened in
          // another tab/browser) would otherwise never reach an already-open session.
          if (dbUser && typeof dbUser.isVerified === 'boolean') {
            token.isVerified = dbUser.isVerified
          }

          // Same for admin rights and the plan: an active session keeps renewing, so a
          // login-time snapshot would let a revoked admin or a downgraded user keep access
          if (dbUser) {
            token.isAdmin = dbUser.isAdmin === true
            token.tier = dbUser.tier
            token.premiumOverride = dbUser.premiumOverride === true
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
        // Client-supplied: anything but short strings is refused before it reaches the
        // limiter, the query or bcrypt (which only reads 72 bytes of a password anyway)
        const { email, password } = (credentials ?? {}) as { email?: unknown; password?: unknown }
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return null
        if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_SIGN_IN_PASSWORD_LENGTH) return null

        // Checked before the DB lookup and bcrypt compare so a locked-out
        // attacker gets no timing signal and costs us no hashing work
        const rateLimitResult = await checkLoginRateLimit(email, getClientIp(request))
        if (!rateLimitResult.allowed) throw new LoginRateLimitedError()

        const db = await getDb()
        // Trimmed like sign-up and forgot-password, so a pasted " me@x.com " still signs in
        const user = await db.collection<IUser>('users').findOne({ email: email.trim().toLowerCase() })
        const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH)
        if (!user || !passwordMatch) return null

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
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
        }
      },
    }),
  ],
})
