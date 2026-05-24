import { auth } from '@/auth'
import { NextResponse } from 'next/server'

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

  // Non-blocking lastSeen update
  if (isProtected && isLoggedIn && session?.user?.id) {
    const userId = session.user.id
    import('@/lib/mongodb')
      .then(({ getDb }) => getDb())
      .then((db) => {
        const { ObjectId } = require('mongodb')
        db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { 'notifications.lastSeen': new Date() } }
        )
      })
      .catch(() => {})
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
