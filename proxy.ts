import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function proxy(req: NextRequest) {
  try {
    const { nextUrl } = req

    if (nextUrl.pathname === '/maintenance') {
      return NextResponse.next()
    }

    return NextResponse.rewrite(new URL('/maintenance', nextUrl))
  } catch {
    return NextResponse.rewrite(new URL('/maintenance', req.nextUrl))
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|logo-dark.png).*)'],
}
