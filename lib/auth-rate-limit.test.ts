import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLoginRateLimit,
  checkMfaRateLimit,
  LOGIN_LIMIT_PER_EMAIL,
  LOGIN_LIMIT_PER_IP,
  LOGIN_RATE_WINDOW_MS,
  MFA_LIMIT_PER_USER,
} from './auth-rate-limit'

// The limiter store is module-level, so every test uses its own keys
let uniqueId = 0
const nextId = () => `t${Date.now()}-${++uniqueId}`

describe('checkLoginRateLimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('allows attempts up to the per-email limit, then blocks', () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL; i++) {
      expect(checkLoginRateLimit(email, `ip-${nextId()}`).allowed).toBe(true)
    }
    const blocked = checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('treats email case and surrounding spaces as the same account', () => {
    const id = nextId()
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL; i++) {
      checkLoginRateLimit(`${id}@example.com`, `ip-${nextId()}`)
    }
    expect(checkLoginRateLimit(`  ${id.toUpperCase()}@EXAMPLE.COM `, `ip-${nextId()}`).allowed).toBe(false)
  })

  it('blocks one IP spraying many accounts', () => {
    const ip = `ip-${nextId()}`
    for (let i = 0; i < LOGIN_LIMIT_PER_IP; i++) {
      expect(checkLoginRateLimit(`${nextId()}@example.com`, ip).allowed).toBe(true)
    }
    expect(checkLoginRateLimit(`${nextId()}@example.com`, ip).allowed).toBe(false)
  })

  it('does not affect other accounts on other IPs', () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i <= LOGIN_LIMIT_PER_EMAIL; i++) checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(checkLoginRateLimit(`${nextId()}@example.com`, `ip-${nextId()}`).allowed).toBe(true)
  })

  it('allows attempts again once the window has passed', () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i <= LOGIN_LIMIT_PER_EMAIL; i++) checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(checkLoginRateLimit(email, `ip-${nextId()}`).allowed).toBe(false)

    vi.advanceTimersByTime(LOGIN_RATE_WINDOW_MS)
    expect(checkLoginRateLimit(email, `ip-${nextId()}`).allowed).toBe(true)
  })
})

describe('checkMfaRateLimit', () => {
  it('allows attempts up to the per-user limit, then blocks', () => {
    const userId = nextId()
    for (let i = 0; i < MFA_LIMIT_PER_USER; i++) {
      expect(checkMfaRateLimit(userId, `ip-${nextId()}`).allowed).toBe(true)
    }
    expect(checkMfaRateLimit(userId, `ip-${nextId()}`).allowed).toBe(false)
  })

  it('keeps MFA and login counters separate', () => {
    const id = nextId()
    const ip = `ip-${nextId()}`
    for (let i = 0; i < MFA_LIMIT_PER_USER; i++) checkMfaRateLimit(id, ip)
    expect(checkLoginRateLimit(`${id}@example.com`, `ip-${nextId()}`).allowed).toBe(true)
  })
})
