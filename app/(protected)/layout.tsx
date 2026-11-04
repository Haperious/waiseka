import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { CurrencyProvider } from '@/context/CurrencyContext'
import type { CurrencyCode } from '@/lib/currency'
import { LOGIN_PATH, MFA_STEP_PATH } from '@/lib/proxy-routing'
import ProtectedShell from './ProtectedShell'

// The session is read here rather than in the root layout, so only signed-in pages
// pay for it and the public pages stay static
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // proxy.ts already redirects these; this is a backstop in case a page is added
  // without updating PROTECTED_ROUTE_PREFIXES
  if (!session) redirect(LOGIN_PATH)
  if (session.user?.mfaVerified === false) redirect(MFA_STEP_PATH)

  const initialCurrency = (session.user?.currency ?? 'PHP') as CurrencyCode

  return (
    <CurrencyProvider initialCurrency={initialCurrency}>
      <ProtectedShell>{children}</ProtectedShell>
    </CurrencyProvider>
  )
}
