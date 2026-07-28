import Link from 'next/link'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="text-center space-y-4">
        <p className="text-8xl font-bold text-gray-200 dark:text-gray-700">404</p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
        <p className="text-gray-400 dark:text-gray-500 text-xs pt-2">
          Need help? Email{' '}
          <a href="mailto:waise.ka.official@gmail.com" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            waise.ka.official@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
