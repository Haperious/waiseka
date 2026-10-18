import { describe, expect, it } from 'vitest'
import { accountIdForSubmit } from './accountSelection'

describe('accountIdForSubmit', () => {
  it('sends the account the user picked', () => {
    expect(accountIdForSubmit('acc1', 'def', true)).toBe('acc1')
    expect(accountIdForSubmit('acc1', '', false)).toBe('acc1')
  })

  it('sends null when the user explicitly picked Unassigned', () => {
    expect(accountIdForSubmit('', 'def', true)).toBeNull()
    expect(accountIdForSubmit('', '', false)).toBeNull()
  })

  it('sends the loaded default when nothing was picked', () => {
    expect(accountIdForSubmit(null, 'def', true)).toBe('def')
  })

  it('sends null when nothing was picked and the user has no default account', () => {
    expect(accountIdForSubmit(null, '', true)).toBeNull()
  })

  it('omits the account while the default is still loading so the server resolves it', () => {
    expect(accountIdForSubmit(null, '', false)).toBeUndefined()
    expect(JSON.stringify({ accountId: accountIdForSubmit(null, '', false) })).toBe('{}')
  })
})
