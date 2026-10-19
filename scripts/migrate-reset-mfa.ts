/**
 * Migration: Reset MFA for all existing users
 *
 * WHY: The original MFA implementation used generateSecret() from otplib with
 * incompatible plugin wiring, producing secrets that don't match what Google
 * Authenticator computes. Any previously enabled MFA is non-functional.
 *
 * WHAT THIS DOES:
 * - Finds all users where mfa.enabled = true
 * - Clears their MFA state (sets enabled=false, wipes secret and backupCodes)
 * - On next login, they will be prompted to re-enroll via the setup flow
 *
 * RUN ONCE: ts-node scripts/migrate-reset-mfa.ts
 */

import { getDb } from '../lib/mongodb'

async function main() {
  const db = await getDb()
  const collection = db.collection('users')

  const affected = await collection.countDocuments({ 'mfa.enabled': true })
  console.log(`Found ${affected} user(s) with MFA enabled- resetting...`)

  if (affected === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  const result = await collection.updateMany(
    { 'mfa.enabled': true },
    {
      $set: {
        'mfa.enabled': false,
        'mfa.secret': '',
        'mfa.backupCodes': [],
      },
      $unset: {
        'mfa.enabledAt': '',
      },
    }
  )

  console.log(`Reset MFA for ${result.modifiedCount} user(s).`)
  console.log('Affected users will be prompted to re-enroll on next login.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
