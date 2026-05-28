import type { Metadata } from 'next'
import { Geist, Playfair_Display } from 'next/font/google'
import './globals.css'
import { auth } from '@/auth'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { ToastProvider } from '@/components/ui/Toast'
import type { CurrencyCode } from '@/lib/currency'

const geist    = Geist({ subsets: ['latin'], variable: '--font-geist' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Waiseka | Personal Budgeting',
  description: 'Track your income, expenses, budgets and financial goals.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const initialCurrency = (session?.user?.currency ?? 'USD') as CurrencyCode

  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} h-full antialiased dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}})();` }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <ToastProvider>
          <LanguageProvider>
            <ThemeProvider>
              <CurrencyProvider initialCurrency={initialCurrency}>{children}</CurrencyProvider>
            </ThemeProvider>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
