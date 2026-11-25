import type { Db, ObjectId } from 'mongodb'
import { verify, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import type { IUser } from '@/lib/models/User'

const otpCrypto = new NobleCryptoPlugin()
const otpBase32 = new ScureBase32Plugin()

/**
 * Checks a 6-digit TOTP code and uses it up, so the same code can't be replayed within
 * its 30-second window (RFC 6238 §5.2) - e.g. one read over a shoulder or from a
 * phishing proxy. The time step is claimed with a conditional update, so two requests
 * racing with the same code can't both pass.
 */
export async function verifyTotpOnce(
  db: Db,
  user: { _id: ObjectId; mfa?: IUser['mfa'] },
  token: string,
): Promise<boolean> {
  const secret = user.mfa?.secret
  if (!secret || !/^\d{6}$/.test(token)) return false

  const lastTimeStep = user.mfa?.lastTimeStep
  let timeStep: number
  try {
    const result = await verify({
      token,
      secret,
      strategy: 'totp',
      crypto: otpCrypto,
      base32: otpBase32,
      ...(typeof lastTimeStep === 'number' && { afterTimeStep: lastTimeStep }),
    })
    if (!result.valid || !('timeStep' in result) || typeof result.timeStep !== 'number') return false
    timeStep = result.timeStep
  } catch {
    // Malformed codes throw rather than returning invalid
    return false
  }

  const claimed = await db.collection<IUser>('users').updateOne(
    {
      _id: user._id,
      $or: [{ 'mfa.lastTimeStep': { $exists: false } }, { 'mfa.lastTimeStep': { $lt: timeStep } }],
    },
    { $set: { 'mfa.lastTimeStep': timeStep } },
  )
  return claimed.modifiedCount === 1
}
