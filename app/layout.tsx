import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { ToastProvider } from '@/components/ui/Toast'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Waiseka — Personal Budgeting',
  description: 'Track your income, expenses, budgets and financial goals.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
        <ToastProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
