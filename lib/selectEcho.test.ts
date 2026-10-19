import { describe, expect, it } from 'vitest'
import { isEmptyValueEcho } from './selectEcho'

describe('isEmptyValueEcho', () => {
  it('ignores an empty value reported while the dropdown is closed', () => {
    expect(isEmptyValueEcho('', 'acct-1', false)).toBe(true)
  })

  it('lets the user pick an empty option ("Unassigned") from the open dropdown', () => {
    expect(isEmptyValueEcho('', 'acct-1', true)).toBe(false)
  })

  it('passes real values through', () => {
    expect(isEmptyValueEcho('acct-2', 'acct-1', false)).toBe(false)
    expect(isEmptyValueEcho('acct-2', '', true)).toBe(false)
  })

  it('does nothing when there was no value to wipe', () => {
    expect(isEmptyValueEcho('', '', false)).toBe(false)
  })
})
