'use client'

import { cn } from '@/lib/utils'

type Step = 'uploading' | 'extracting' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'done', label: 'Done' },
]

const STEP_INDEX: Record<Step, number> = { uploading: 0, extracting: 1, done: 2 }

interface ProcessingScreenProps {
  step: Step
}

export default function ProcessingScreen({ step }: ProcessingScreenProps) {
  const currentIndex = STEP_INDEX[step]

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < currentIndex
                  ? 'bg-green-500 text-white'
                  : i === currentIndex
                    ? 'border-2 border-green-500 text-green-600 dark:text-green-400'
                    : 'border-2 border-gray-300 dark:border-gray-600 text-gray-400'
              )}
            >
              {i < currentIndex ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={cn(
                'text-sm',
                i === currentIndex
                  ? 'font-semibold text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-px w-8',
                  i < currentIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {step !== 'done' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {step === 'uploading' ? 'Uploading your file…' : 'Extracting transactions…'}
        </div>
      )}
    </div>
  )
}
