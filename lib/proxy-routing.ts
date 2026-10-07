import { LEGAL_DOCUMENT_PATHS } from '@/lib/legal/legalDocuments'

/** Signed-in only; matched by prefix. */
export const PROTECTED_ROUTE_PREFIXES = ['/dashboard', '/transactions', '/budgets', '/goals', '/reports', '/settings', '/ai', '/admin']

/** Signed-out only (signed-in users are sent to the dashboard); matched exactly. */
export const SIGNED_OUT_ONLY_ROUTES = ['/login', '/register']

/**
 * Reachable by everyone, signed in or not, and never redirected - matched
 * exactly. Checked first so a future protected prefix can't capture them.
 */
export const OPEN_ROUTES: readonly string[] = Object.values(LEGAL_DOCUMENT_PATHS)

export const LOGIN_PATH = '/login'
export const MFA_STEP_PATH = '/login/mfa'
export const DASHBOARD_PATH = '/dashboard'
const ADMIN_ROUTE_PREFIX = '/admin'

export interface ProxyRequestState {
  pathname: string
  isLoggedIn: boolean
  /** From the session; false only while an MFA account has passed the password step but not the code step. */
  mfaVerified?: boolean
  isAdmin?: boolean
}

/** Decide where proxy.ts should redirect a request, or null to let it through. */
export function resolveProxyRedirect({ pathname, isLoggedIn, mfaVerified, isAdmin }: ProxyRequestState): string | null {
  if (OPEN_ROUTES.includes(pathname)) return null

  const isProtected = PROTECTED_ROUTE_PREFIXES.some((route) => pathname.startsWith(route))
  const isSignedOutOnly = SIGNED_OUT_ONLY_ROUTES.includes(pathname)

  if (isProtected && !isLoggedIn) return LOGIN_PATH

  // Password passed but the MFA code step hasn't: keep the session on the MFA page.
  // API routes enforce the same rule via requireVerifiedSession().
  const awaitingMfa = isLoggedIn && mfaVerified === false
  if (awaitingMfa && (isProtected || isSignedOutOnly)) return MFA_STEP_PATH

  if (isSignedOutOnly && isLoggedIn) return DASHBOARD_PATH

  if (pathname.startsWith(ADMIN_ROUTE_PREFIX) && isLoggedIn && isAdmin !== true) return DASHBOARD_PATH

  return null
}
