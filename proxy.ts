import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'
import { resolveProxyRedirect } from '@/lib/proxy-routing'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl, auth: session } = req

  // Route rules live in lib/proxy-routing.ts so they can be unit tested
  const redirectPath = resolveProxyRedirect({
    pathname: nextUrl.pathname,
    isLoggedIn: !!session,
    mfaVerified: session?.user?.mfaVerified,
    isAdmin: (session as { user?: { isAdmin?: boolean } } | null)?.user?.isAdmin,
  })

  return redirectPath ? NextResponse.redirect(new URL(redirectPath, nextUrl)) : NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
