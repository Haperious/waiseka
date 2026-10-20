import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// No database here: the limiter falls back to its in-memory window, which these tests cover
vi.mock('@/lib/mongodb', () => ({ getDb: () => Promise.reject(new Error('no database in unit tests')) }))
vi.spyOn(console, 'warn').mockImplementation(() => {})

const {
  checkLoginRateLimit,
  checkMfaRateLimit,
  LOGIN_LIMIT_PER_EMAIL,
  LOGIN_LIMIT_PER_IP,
  LOGIN_RATE_WINDOW_MS,
  MFA_LIMIT_PER_USER,
} = await import('./auth-rate-limit')

// The limiter store is module-level, so every test uses its own keys
let uniqueId = 0
const nextId = () => `t${Date.now()}-${++uniqueId}`

const loginAllowed = async (email: string, ip = `ip-${nextId()}`) => (await checkLoginRateLimit(email, ip)).allowed
const mfaAllowed = async (userId: string, ip = `ip-${nextId()}`) => (await checkMfaRateLimit(userId, ip)).allowed

describe('checkLoginRateLimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('allows attempts up to the per-email limit, then blocks', async () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL; i++) {
      expect(await loginAllowed(email)).toBe(true)
    }
    const blocked = await checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('treats email case and surrounding spaces as the same account', async () => {
    const id = nextId()
    for (let i = 0; i < LOGIN_LIMIT_PER_EMAIL; i++) await checkLoginRateLimit(`${id}@example.com`, `ip-${nextId()}`)
    expect(await loginAllowed(`  ${id.toUpperCase()}@EXAMPLE.COM `)).toBe(false)
  })

  it('blocks one IP spraying many accounts', async () => {
    const ip = `ip-${nextId()}`
    for (let i = 0; i < LOGIN_LIMIT_PER_IP; i++) {
      expect(await loginAllowed(`${nextId()}@example.com`, ip)).toBe(true)
    }
    expect(await loginAllowed(`${nextId()}@example.com`, ip)).toBe(false)
  })

  it('does not affect other accounts on other IPs', async () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i <= LOGIN_LIMIT_PER_EMAIL; i++) await checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(await loginAllowed(`${nextId()}@example.com`)).toBe(true)
  })

  it('allows attempts again once the window has passed', async () => {
    const email = `${nextId()}@example.com`
    for (let i = 0; i <= LOGIN_LIMIT_PER_EMAIL; i++) await checkLoginRateLimit(email, `ip-${nextId()}`)
    expect(await loginAllowed(email)).toBe(false)

    vi.advanceTimersByTime(LOGIN_RATE_WINDOW_MS)
    expect(await loginAllowed(email)).toBe(true)
  })
})

describe('checkMfaRateLimit', () => {
  it('allows attempts up to the per-user limit, then blocks', async () => {
    const userId = nextId()
    for (let i = 0; i < MFA_LIMIT_PER_USER; i++) {
      expect(await mfaAllowed(userId)).toBe(true)
    }
    expect(await mfaAllowed(userId)).toBe(false)
  })

  it('keeps MFA and login counters separate', async () => {
    const id = nextId()
    const ip = `ip-${nextId()}`
    for (let i = 0; i < MFA_LIMIT_PER_USER; i++) await checkMfaRateLimit(id, ip)
    expect(await loginAllowed(`${id}@example.com`)).toBe(true)
  })
})
