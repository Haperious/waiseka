import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const protectedRoutes = ['/dashboard', '/transactions', '/budgets', '/goals', '/reports', '/settings', '/ai', '/admin']
const publicRoutes = ['/login', '/register']

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isProtected = protectedRoutes.some((route) => nextUrl.pathname.startsWith(route))
  const isPublic = publicRoutes.some((route) => nextUrl.pathname === route)

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  if (isPublic && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl))
  }

  if (nextUrl.pathname.startsWith('/admin') && isLoggedIn) {
    const isAdmin = (session as { user?: { isAdmin?: boolean } })?.user?.isAdmin === true
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
