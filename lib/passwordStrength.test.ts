import { describe, expect, it } from 'vitest'
import { scorePassword } from './passwordStrength'

describe('scorePassword', () => {
  it('never drops below 1 so the meter always shows something', () => {
    expect(scorePassword('a')).toBe(1)
  })

  it('scores one point each for length, mixed case, a digit and a symbol', () => {
    expect(scorePassword('sweldoko')).toBe(1)
    expect(scorePassword('Sweldoko')).toBe(2)
    expect(scorePassword('Sweldo26')).toBe(3)
    expect(scorePassword('Sweldo26!')).toBe(4)
  })

  it('counts 12+ characters in place of a symbol', () => {
    expect(scorePassword('Sweldo2026ko')).toBe(4)
  })
})
