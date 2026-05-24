import type { Session } from 'next-auth'

export function adminGate(session: Session | null): void {
  if (!session || !session.user.isAdmin) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
}
