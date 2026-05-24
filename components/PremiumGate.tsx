'use client'

import { useSession } from 'next-auth/react'
import { Lock } from 'lucide-react'
import { isPremium } from '@/lib/tier'
import { Card, CardContent } from '@/components/ui/Card'

export default function PremiumGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  if (status === 'loading') return null
  if (!session) return null

  if (isPremium(session.user as { tier: string; premiumOverride: boolean })) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="flex flex-col items-center text-center py-12 gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Premium Feature
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            This feature is available to Premium subscribers. Upgrade your account to unlock AI-powered financial analysis.
          </p>
          <div className="mt-2 px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium cursor-not-allowed opacity-60">
            Upgrade to Premium
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Premium upgrades will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
