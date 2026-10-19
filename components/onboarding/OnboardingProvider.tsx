'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import OnboardingChecklist from './OnboardingChecklist'
import type { IOnboarding, OnboardingStepId } from '@/lib/models/User'

const DEFAULT_ONBOARDING: IOnboarding = {
  completedAt: null,
  stepsCompleted: [],
  dismissed: false,
}

export default function OnboardingProvider() {
  const { data: session, status } = useSession()
  const [onboarding, setOnboarding] = useState<IOnboarding | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/users/me')
      .then((res) => res.json())
      .then((user) => {
        // Support existing users who don't have the field yet (pre-migration)
        setOnboarding(user.onboarding ?? DEFAULT_ONBOARDING)
      })
      .catch((err) => {
        console.error('[OnboardingProvider] failed to fetch user:', err)
        // Fail silently - onboarding is non-critical
      })
  }, [status])

  // Don't render until we have auth + data
  if (!session || !onboarding) return null

  // Already completed or dismissed - nothing to show
  if (onboarding.completedAt || onboarding.dismissed) return null

  return (
    <OnboardingChecklist
      initialStepsCompleted={onboarding.stepsCompleted as OnboardingStepId[]}
      initialDismissed={onboarding.dismissed}
      initialCompletedAt={onboarding.completedAt}
    />
  )
}
