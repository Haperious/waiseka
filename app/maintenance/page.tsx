'use client'

import Image from 'next/image'
import { useTheme } from '@/context/ThemeContext'

export default function MaintenancePage() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-center space-y-5 max-w-md flex flex-col items-center">
        <Image
          src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
          alt="Waiseka"
          width={64}
          height={64}
          priority
          className="rounded-2xl"
        />
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          We&apos;ll be right back
        </h1>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Waiseka is currently undergoing scheduled maintenance. We&apos;re working to improve
          things and should be back online shortly. Thanks for your patience.
        </p>
      </div>
    </div>
  )
}
