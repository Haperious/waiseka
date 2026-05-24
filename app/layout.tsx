import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/components/ui/Toast'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Waiseka — Personal Budgeting',
  description: 'Track your income, expenses, budgets and financial goals.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}})();` }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <ToastProvider>
          <ThemeProvider>
            <CurrencyProvider>{children}</CurrencyProvider>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
