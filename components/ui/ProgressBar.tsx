import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
}

export default function ProgressBar({ value, max = 100, className, showLabel }: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100)

  const color =
    percent >= 90
      ? 'bg-red-500'
      : percent >= 70
      ? 'bg-yellow-500'
      : 'bg-green-500'

  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', color)}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <p className={cn('mt-1 text-xs font-medium', {
          'text-red-600 dark:text-red-400': percent >= 90,
          'text-yellow-600 dark:text-yellow-400': percent >= 70 && percent < 90,
          'text-green-600 dark:text-green-400': percent < 70,
        })}>
          {Math.round(percent)}%
        </p>
      )}
    </div>
  )
}
