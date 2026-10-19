import { describe, expect, it } from 'vitest'
import { countCutoffsUntil } from './cutoffs'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('countCutoffsUntil', () => {
  it('counts the 15th and the last day of each month after today', () => {
    // Oct 19 -> Dec 31: Oct 31, Nov 15, Nov 30, Dec 15, Dec 31
    expect(countCutoffsUntil(d(2026, 12, 31), d(2026, 10, 19))).toBe(5)
  })

  it('does not count a payday that falls on today', () => {
    expect(countCutoffsUntil(d(2026, 10, 31), d(2026, 10, 15))).toBe(1)
  })

  it('counts a payday on the target date', () => {
    expect(countCutoffsUntil(d(2026, 11, 15), d(2026, 10, 19))).toBe(2)
  })

  it('uses the real month end in February', () => {
    expect(countCutoffsUntil(d(2027, 3, 1), d(2027, 2, 16))).toBe(1)
  })

  it('returns 0 for a target before the next payday', () => {
    expect(countCutoffsUntil(d(2026, 10, 25), d(2026, 10, 19))).toBe(0)
    expect(countCutoffsUntil(d(2026, 9, 1), d(2026, 10, 19))).toBe(0)
  })
})
