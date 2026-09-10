import { describe, it, expect } from 'vitest'
import { monthMeta, monthsBack, averageAndDelta, savingsRate, selectBiggestMovers, type CategoryRangeStats } from './monthlyStats'

describe('monthMeta', () => {
  it('computes start/end/label for a mid-year month', () => {
    const m = monthMeta(2026, 9)
    expect(m.label).toBe('Sep')
    expect(m.key).toBe('2026-9')
    expect(m.start).toEqual(new Date(Date.UTC(2026, 8, 1)))
    expect(m.end).toEqual(new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999)))
  })

  it('handles December correctly (year-boundary edge case)', () => {
    const m = monthMeta(2026, 12)
    expect(m.label).toBe('Dec')
    expect(m.end).toEqual(new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)))
  })
})

describe('monthsBack', () => {
  it('returns the 3 months ending at the given month, oldest first', () => {
    const months = monthsBack(new Date(Date.UTC(2026, 8, 15)), 3) // Sep 2026
    expect(months.map((m) => m.label)).toEqual(['Jul', 'Aug', 'Sep'])
  })

  it('crosses a year boundary correctly', () => {
    const months = monthsBack(new Date(Date.UTC(2026, 1, 10)), 3) // Feb 2026
    expect(months.map((m) => `${m.label} ${m.year}`)).toEqual(['Dec 2025', 'Jan 2026', 'Feb 2026'])
  })
})

describe('averageAndDelta', () => {
  it('computes the mean and percentage above it', () => {
    const { average, percentageAbove } = averageAndDelta([100, 200, 300], 400)
    expect(average).toBe(200)
    expect(percentageAbove).toBe(100)
  })

  it('returns 0 percentageAbove when there is no baseline', () => {
    expect(averageAndDelta([], 500)).toEqual({ average: 0, percentageAbove: 0 })
  })

  it('reports a negative percentage when current is below average', () => {
    const { percentageAbove } = averageAndDelta([100, 100], 80)
    expect(percentageAbove).toBe(-20)
  })
})

describe('savingsRate', () => {
  it('matches the /api/summary formula', () => {
    expect(savingsRate(72300, 56700, 15600)).toBe(Math.round(((72300 - 56700 + 15600) / 72300) * 100))
  })

  it('returns 0 when income is zero', () => {
    expect(savingsRate(0, 100, 0)).toBe(0)
  })
})

describe('selectBiggestMovers', () => {
  const category = (name: string, byMonth: number[], currentVsAverage: number): CategoryRangeStats => ({
    name, color: '#000', byMonth, average: 0, currentVsAverage,
  })

  it('excludes categories with fewer than 2 months of nonzero spend', () => {
    const categories = [
      category('New thing', [0, 0, 500], 999),
      category('Groceries', [1000, 1200, 900], -10),
    ]
    const movers = selectBiggestMovers(categories)
    expect(movers.map((c) => c.name)).toEqual(['Groceries'])
  })

  it('ranks by absolute deviation from average, not raw sign', () => {
    const categories = [
      category('Small rise', [100, 100, 105], 5),
      category('Big drop', [100, 100, 40], -60),
    ]
    const movers = selectBiggestMovers(categories)
    expect(movers.map((c) => c.name)).toEqual(['Big drop', 'Small rise'])
  })

  it('caps results at the given limit', () => {
    const categories = Array.from({ length: 10 }, (_, i) =>
      category(`Cat ${i}`, [100, 100, 100 + i * 10], i * 10)
    )
    expect(selectBiggestMovers(categories, 6)).toHaveLength(6)
  })
})
