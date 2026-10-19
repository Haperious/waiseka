import { describe, expect, it } from 'vitest'
import { accountIdForSubmit, pickDefaultAccountId } from './accountSelection'

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

describe('pickDefaultAccountId', () => {
  const credit = { _id: 'cc', type: 'credit' }
  const wallet = { _id: 'wallet', type: 'debit' }
  const bank = { _id: 'bank', type: 'debit' }

  it('uses the saved default account', () => {
    expect(pickDefaultAccountId([wallet, bank], 'bank')).toBe('bank')
  })

  it('allows a non-debit account as the saved default', () => {
    expect(pickDefaultAccountId([credit, wallet], 'cc')).toBe('cc')
  })

  it('falls back to the first debit account when no default is saved', () => {
    expect(pickDefaultAccountId([credit, wallet, bank], null)).toBe('wallet')
    expect(pickDefaultAccountId([credit, wallet, bank], undefined)).toBe('wallet')
  })

  it('falls back when the saved default is archived', () => {
    expect(pickDefaultAccountId([{ ...bank, isArchived: true }, wallet], 'bank')).toBe('wallet')
  })

  it('falls back when the saved default no longer exists', () => {
    expect(pickDefaultAccountId([wallet], 'deleted')).toBe('wallet')
  })

  it('skips archived debit accounts in the fallback', () => {
    expect(pickDefaultAccountId([{ ...wallet, isArchived: true }, bank], null)).toBe('bank')
  })

  it('is unassigned when there is no active debit account', () => {
    expect(pickDefaultAccountId([credit], null)).toBe('')
    expect(pickDefaultAccountId([], null)).toBe('')
  })
})
