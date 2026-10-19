import { describe, expect, it } from 'vitest'
import { ObjectId, type Db } from 'mongodb'
import { consumeMfaTicket, hashMfaTicket, issueMfaTicket, MFA_TICKET_TTL_MS } from './mfa-ticket'

interface FakeUser {
  _id: ObjectId
  mfa?: { enabled: boolean; pendingTicket?: { tokenHash: string; expiresAt: Date } }
}

/**
 * Minimal stand-in for the users collection, supporting exactly the two
 * operations lib/mfa-ticket.ts performs. Not a general Mongo fake.
 */
function createFakeDb(users: FakeUser[]) {
  const collection = {
    async updateOne(filter: { _id: ObjectId }, update: { $set: Record<string, unknown> }) {
      const user = users.find((u) => u._id.equals(filter._id))
      if (!user) return
      user.mfa = user.mfa ?? { enabled: false }
      user.mfa.pendingTicket = update.$set['mfa.pendingTicket'] as { tokenHash: string; expiresAt: Date }
    },
    async findOneAndUpdate(filter: Record<string, unknown>) {
      const expiresAfter = (filter['mfa.pendingTicket.expiresAt'] as { $gt: Date }).$gt
      const user = users.find(
        (u) =>
          u._id.equals(filter._id as ObjectId) &&
          u.mfa?.enabled === filter['mfa.enabled'] &&
          u.mfa?.pendingTicket?.tokenHash === filter['mfa.pendingTicket.tokenHash'] &&
          (u.mfa?.pendingTicket?.expiresAt ?? NOT_SET) > expiresAfter
      )
      if (!user) return null
      delete user.mfa!.pendingTicket
      return { _id: user._id }
    },
  }
  return { collection: () => collection } as unknown as Db
}

const NOT_SET = new Date(0)
const NOW = new Date('2026-10-07T09:00:00Z')
const later = (ms: number) => new Date(NOW.getTime() + ms)

function setup(mfaEnabled = true) {
  const user: FakeUser = { _id: new ObjectId(), mfa: { enabled: mfaEnabled } }
  return { user, userId: user._id.toHexString(), db: createFakeDb([user]) }
}

describe('MFA ticket', () => {
  it('stores only the hash of the issued ticket', async () => {
    const { user, userId, db } = setup()
    const ticket = await issueMfaTicket(db, userId, NOW)
    expect(user.mfa?.pendingTicket?.tokenHash).toBe(hashMfaTicket(ticket))
    expect(user.mfa?.pendingTicket?.tokenHash).not.toBe(ticket)
  })

  it('accepts the issued ticket once, then never again', async () => {
    const { userId, db } = setup()
    const ticket = await issueMfaTicket(db, userId, NOW)
    expect(await consumeMfaTicket(db, userId, ticket, later(1000))).toBe(true)
    expect(await consumeMfaTicket(db, userId, ticket, later(2000))).toBe(false)
  })

  it('rejects a wrong ticket', async () => {
    const { userId, db } = setup()
    await issueMfaTicket(db, userId, NOW)
    expect(await consumeMfaTicket(db, userId, 'guessed-ticket', later(1000))).toBe(false)
  })

  it('rejects an expired ticket', async () => {
    const { userId, db } = setup()
    const ticket = await issueMfaTicket(db, userId, NOW)
    expect(await consumeMfaTicket(db, userId, ticket, later(MFA_TICKET_TTL_MS + 1))).toBe(false)
  })

  it("rejects another user's ticket", async () => {
    const alice = setup()
    const bob = setup()
    const aliceTicket = await issueMfaTicket(alice.db, alice.userId, NOW)
    expect(await consumeMfaTicket(bob.db, bob.userId, aliceTicket, later(1000))).toBe(false)
  })

  it('rejects when MFA is not enabled on the account', async () => {
    const { userId, db } = setup(false)
    const ticket = await issueMfaTicket(db, userId, NOW)
    expect(await consumeMfaTicket(db, userId, ticket, later(1000))).toBe(false)
  })

  it('rejects a malformed user id without querying', async () => {
    const { db } = setup()
    expect(await consumeMfaTicket(db, 'not-an-object-id', 'x', NOW)).toBe(false)
  })
})
