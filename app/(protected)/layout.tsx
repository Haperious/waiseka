import { auth } from '@/auth'
import { CurrencyProvider } from '@/context/CurrencyContext'
import type { CurrencyCode } from '@/lib/currency'
import ProtectedShell from './ProtectedShell'

// The session is read here rather than in the root layout, so only signed-in pages
// pay for it and the public pages stay static
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const initialCurrency = (session?.user?.currency ?? 'PHP') as CurrencyCode

  return (
    <CurrencyProvider initialCurrency={initialCurrency}>
      <ProtectedShell>{children}</ProtectedShell>
    </CurrencyProvider>
  )
}
