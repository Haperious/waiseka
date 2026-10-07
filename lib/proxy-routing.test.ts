import { describe, expect, it } from 'vitest'
import { DASHBOARD_PATH, LOGIN_PATH, MFA_STEP_PATH, resolveProxyRedirect, type ProxyRequestState } from './proxy-routing'
import { LEGAL_DOCUMENT_PATHS } from './legal/legalDocuments'

const SIGNED_OUT: Omit<ProxyRequestState, 'pathname'> = { isLoggedIn: false }
const SIGNED_IN: Omit<ProxyRequestState, 'pathname'> = { isLoggedIn: true, mfaVerified: true, isAdmin: false }
const AWAITING_MFA: Omit<ProxyRequestState, 'pathname'> = { isLoggedIn: true, mfaVerified: false, isAdmin: false }
const ADMIN: Omit<ProxyRequestState, 'pathname'> = { isLoggedIn: true, mfaVerified: true, isAdmin: true }

describe('legal pages are reachable by everyone, with no redirect', () => {
  const visitors = { 'signed out': SIGNED_OUT, 'signed in': SIGNED_IN, 'awaiting MFA': AWAITING_MFA, admin: ADMIN }

  for (const path of Object.values(LEGAL_DOCUMENT_PATHS)) {
    for (const [visitor, state] of Object.entries(visitors)) {
      it(`${path} - ${visitor}`, () => {
        expect(resolveProxyRedirect({ pathname: path, ...state })).toBeNull()
      })
    }
  }
})

describe('existing route rules are unchanged', () => {
  it('sends signed-out visitors from protected pages to login', () => {
    expect(resolveProxyRedirect({ pathname: '/dashboard', ...SIGNED_OUT })).toBe(LOGIN_PATH)
    expect(resolveProxyRedirect({ pathname: '/settings', ...SIGNED_OUT })).toBe(LOGIN_PATH)
  })

  it('lets signed-out visitors open login, register and the landing page', () => {
    expect(resolveProxyRedirect({ pathname: '/login', ...SIGNED_OUT })).toBeNull()
    expect(resolveProxyRedirect({ pathname: '/register', ...SIGNED_OUT })).toBeNull()
    expect(resolveProxyRedirect({ pathname: '/', ...SIGNED_OUT })).toBeNull()
  })

  it('sends signed-in users away from login and register', () => {
    expect(resolveProxyRedirect({ pathname: '/login', ...SIGNED_IN })).toBe(DASHBOARD_PATH)
    expect(resolveProxyRedirect({ pathname: '/register', ...SIGNED_IN })).toBe(DASHBOARD_PATH)
  })

  it('lets signed-in users through to protected pages', () => {
    expect(resolveProxyRedirect({ pathname: '/dashboard', ...SIGNED_IN })).toBeNull()
  })

  it('keeps a session awaiting MFA on the MFA step', () => {
    expect(resolveProxyRedirect({ pathname: '/dashboard', ...AWAITING_MFA })).toBe(MFA_STEP_PATH)
    expect(resolveProxyRedirect({ pathname: '/login', ...AWAITING_MFA })).toBe(MFA_STEP_PATH)
    expect(resolveProxyRedirect({ pathname: MFA_STEP_PATH, ...AWAITING_MFA })).toBeNull()
  })

  it('only lets admins into /admin', () => {
    expect(resolveProxyRedirect({ pathname: '/admin', ...SIGNED_IN })).toBe(DASHBOARD_PATH)
    expect(resolveProxyRedirect({ pathname: '/admin/users', ...ADMIN })).toBeNull()
  })
})
