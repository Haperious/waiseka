import type { Metadata } from 'next'
import { Geist, Playfair_Display } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { ToastProvider } from '@/components/ui/Toast'

const geist    = Geist({ subsets: ['latin'], variable: '--font-geist' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WaiseKa | Personal Budgeting',
  description: 'Track your income, expenses, budgets and financial goals.',
}

// Reads no session or cookies, so public pages (landing, legal) can be prerendered and
// served from the CDN without waking the server. Session-aware providers live in
// app/(protected)/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${playfair.variable} h-full antialiased light`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <ToastProvider>
          <LanguageProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
