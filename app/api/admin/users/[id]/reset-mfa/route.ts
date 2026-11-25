import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireAdminSession } from '@/lib/auth-helpers'
import { getDb } from '@/lib/mongodb'
import { objectIdParam } from '@/lib/route-params'
import { readJsonBody } from '@/lib/request'
import { confirmPassword } from '@/lib/reauth'
import { getClientIp } from '@/lib/rate-limit'
import { notifyMfaChange } from '@/lib/mfa-notify'
import type { IUser } from '@/lib/models/User'

/**
 * POST /api/admin/users/:id/reset-mfa  { password }
 *
 * Recovery for a user who lost both their authenticator and backup codes. Removes their
 * two-factor setup and signs them out everywhere, so they sign in with their password and
 * enrol again. Only do this after confirming the request really comes from the owner.
 *
 * It bypasses the user's second factor, so it asks for more than an admin session: the
 * admin's own password (rate-limited), never the admin's own account (that goes through
 * Settings, which needs a code), an email to the user, and an audit record.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const _id = await objectIdParam(params)
  if (_id instanceof NextResponse) return _id
  if (_id.equals(session.user.id)) {
    return NextResponse.json({ error: 'Change your own two-factor settings in Settings → Security' }, { status: 400 })
  }

  const body = await readJsonBody(req)
  if (body instanceof NextResponse) return body

  const db = await getDb()
  const users = db.collection<IUser>('users')

  const admin = await users.findOne({ _id: new ObjectId(session.user.id) }, { projection: { password: 1 } })
  const reauthError = await confirmPassword(session.user.id, admin?.password, body.password)
  if (reauthError) return reauthError

  const now = new Date()
  // Matches only an account with MFA on, so a repeat click is a clear 409, not a silent no-op
  const target = await users.findOneAndUpdate(
    { _id, 'mfa.enabled': true },
    { $unset: { mfa: '' }, $set: { sessionsRevokedAt: now, updatedAt: now } },
    { projection: { name: 1, email: 1 } },
  )
  if (!target) {
    const exists = await users.countDocuments({ _id }, { limit: 1 })
    return exists
      ? NextResponse.json({ error: 'This user does not have two-factor authentication on' }, { status: 409 })
      : NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await db.collection('adminAudit').insertOne({
    action: 'mfa_reset',
    adminId: session.user.id,
    targetUserId: _id.toString(),
    ip: getClientIp(req),
    at: now,
  })

  notifyMfaChange(db, target, 'reset_by_admin')

  return NextResponse.json({ success: true })
}
