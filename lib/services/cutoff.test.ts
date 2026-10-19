import { describe, it, expect } from 'vitest'
import { resolveCutoffPeriod, cutoffPrefsFor, countCutoffsBetween } from './cutoff'

function utc(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day))
}

describe('resolveCutoffPeriod', () => {
  it('defaults to semi-monthly 15/30 when no cutoffDays are configured', () => {
    const period = resolveCutoffPeriod({}, utc(2026, 9, 23))
    expect(period.index).toBe(2)
    expect(period.label).toBe('16–30 Sep')
    expect(period.start).toEqual(utc(2026, 9, 16))
    expect(period.daysTotal).toBe(15)
    expect(period.daysLeft).toBe(8) // 23..30 inclusive
  })

  it('resolves the first half of a semi-monthly period', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2026, 9, 5))
    expect(period.index).toBe(1)
    expect(period.label).toBe('1–15 Sep')
    expect(period.daysTotal).toBe(15)
    expect(period.daysLeft).toBe(11) // 5..15 inclusive
  })

  it('clamps a 30-day cutoff to the last day of February (non-leap year)', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2027, 2, 20))
    expect(period.index).toBe(2)
    expect(period.label).toBe('16–28 Feb')
    expect(period.daysTotal).toBe(13)
  })

  it('clamps a 30-day cutoff to the last day of February (leap year)', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2028, 2, 29))
    expect(period.label).toBe('16–29 Feb')
    expect(period.daysLeft).toBe(1)
  })

  it('extends the final period through the 31st in a 31-day month', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2026, 1, 31))
    expect(period.index).toBe(2)
    expect(period.label).toBe('16–31 Jan')
    expect(period.daysTotal).toBe(16)
    expect(period.daysLeft).toBe(1)
  })

  it('treats a single-day monthly cutoff as one period covering the whole month', () => {
    const period = resolveCutoffPeriod({ cutoffMode: 'monthly', cutoffDays: [30] }, utc(2026, 4, 10))
    expect(period.index).toBe(1)
    expect(period.label).toBe('1–30 Apr')
    expect(period.daysTotal).toBe(30)
  })

  it('supports arbitrary custom cutoff days', () => {
    const period = resolveCutoffPeriod({ cutoffMode: 'custom', cutoffDays: [10, 20] }, utc(2026, 6, 25))
    expect(period.index).toBe(3)
    expect(period.label).toBe('21–30 Jun')
  })

  it('resolves the first day of a month as the start of period 1', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2026, 3, 1))
    expect(period.index).toBe(1)
    expect(period.start).toEqual(utc(2026, 3, 1))
    expect(period.daysLeft).toBe(15)
  })

  it('reports zero days left is never negative on the boundary day itself', () => {
    const period = resolveCutoffPeriod({ cutoffDays: [15, 30] }, utc(2026, 5, 15))
    expect(period.index).toBe(1)
    expect(period.daysLeft).toBe(1)
  })
})

describe('cutoffPrefsFor', () => {
  const prefs = {
    cutoffMode: 'monthly' as const,
    cutoffDays: [15],
    cutoffByCurrency: { PHP: { mode: 'custom' as const, days: [5, 20] } },
  }

  it('uses the currency\'s own schedule when it has one', () => {
    expect(cutoffPrefsFor(prefs, 'PHP')).toEqual({ cutoffMode: 'custom', cutoffDays: [5, 20], cutoffAnchorDate: undefined })
  })

  it('falls back to the top-level schedule for a currency without one', () => {
    expect(cutoffPrefsFor(prefs, 'QAR')).toEqual({ cutoffMode: 'monthly', cutoffDays: [15], cutoffAnchorDate: undefined })
  })

  it('gives QAR on the 15th and PHP on the 5th/20th their own periods', () => {
    const d = utc(2026, 10, 12)
    const qar = resolveCutoffPeriod(cutoffPrefsFor(prefs, 'QAR'), d)
    const php = resolveCutoffPeriod(cutoffPrefsFor(prefs, 'PHP'), d)
    expect(qar.label).toBe('1–15 Oct')
    expect(qar.daysLeft).toBe(4)
    expect(php.label).toBe('6–20 Oct')
    expect(php.daysLeft).toBe(9)
  })

  it('handles missing preferences', () => {
    expect(cutoffPrefsFor(undefined, 'PHP')).toEqual({ cutoffMode: undefined, cutoffDays: undefined, cutoffAnchorDate: undefined })
  })
})

describe('countCutoffsBetween', () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

  it('counts semi-monthly paydays (15th and month end) after today, through the target', () => {
    // Oct 19 -> Dec 31: Oct 31, Nov 15, Nov 30, Dec 15, Dec 31
    expect(countCutoffsBetween({}, d(2026, 10, 19), d(2026, 12, 31))).toBe(5)
  })

  it('does not count a payday on the start date, but counts one on the target date', () => {
    expect(countCutoffsBetween({}, d(2026, 10, 15), d(2026, 10, 31))).toBe(1)
    expect(countCutoffsBetween({}, d(2026, 10, 19), d(2026, 11, 15))).toBe(2)
  })

  it('uses the real month end in February', () => {
    expect(countCutoffsBetween({}, d(2027, 2, 16), d(2027, 3, 1))).toBe(1)
  })

  it('counts once a month for a monthly schedule', () => {
    expect(countCutoffsBetween({ cutoffMode: 'monthly', cutoffDays: [30] }, d(2026, 10, 19), d(2027, 4, 30))).toBe(7)
  })

  it('follows a custom mid-month day', () => {
    // Semi-monthly on the 10th: Nov 10, Nov 30
    expect(countCutoffsBetween({ cutoffMode: 'semi-monthly', cutoffDays: [10, 30] }, d(2026, 10, 31), d(2026, 11, 30))).toBe(2)
  })

  it('returns 0 when no payday falls before the target', () => {
    expect(countCutoffsBetween({}, d(2026, 10, 19), d(2026, 10, 25))).toBe(0)
    expect(countCutoffsBetween({}, d(2026, 10, 19), d(2026, 9, 1))).toBe(0)
  })
})
