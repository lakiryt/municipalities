import { describe, it, expect } from 'vitest'
import { makeScale, suggestScale, quantile, canLog } from './colorScale'

describe('suggestScale', () => {
  it('picks log for data spanning orders of magnitude (population, density)', () => {
    expect(suggestScale([5, 50, 500, 5000, 50000, 120, 900, 30])).toBe('log')
  })

  it('picks linear for evenly spread data (rates, rents) and anything non-positive', () => {
    expect(suggestScale([28, 31, 35, 38, 41, 45, 52])).toBe('linear')
    expect(suggestScale([-3, 1, 1000, 100000])).toBe('linear')
  })
})

describe('makeScale', () => {
  const values = [1, 10, 100, 1000, 10000]

  it('linear maps min..max to 0..1', () => {
    const s = makeScale(values, 'linear', false)
    expect(s.t(1)).toBe(0)
    expect(s.t(10000)).toBe(1)
    expect(s.t(5000.5)).toBeCloseTo(0.5)
  })

  it('log spaces each order of magnitude evenly', () => {
    const s = makeScale(values, 'log', false)
    expect(s.t(100)).toBeCloseTo(0.5)
    expect(s.valueAt(0.25)).toBeCloseTo(10)
  })

  it('falls back to linear when log is impossible (many non-positive values)', () => {
    expect(canLog([0, 1, 2])).toBe(false)
    expect(makeScale([0, 1, 2], 'log', false).kind).toBe('linear')
  })

  it('allows a few zeros on a log scale, painting them in the lowest color', () => {
    const data = [0, ...Array.from({ length: 40 }, (_, i) => 10 ** (i / 10))]
    expect(canLog(data)).toBe(true)
    expect(suggestScale(data)).toBe('log')
    const s = makeScale(data, 'auto', false)
    expect(s.kind).toBe('log')
    expect(s.lo).toBe(1)
    expect(s.clippedLow).toBe(true)   // the legend shows "≤ 1"
    expect(s.t(0)).toBe(0)
  })

  it('rank spreads values evenly regardless of their size, with ties sharing a position', () => {
    const s = makeScale([1, 2, 2, 1000], 'rank', false)
    expect(s.t(1)).toBe(0)
    expect(s.t(2)).toBeCloseTo(0.5)
    expect(s.t(1000)).toBe(1)
  })

  it('clip narrows the range to the 2nd–98th percentiles and clamps the rest to the ends', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1).concat([100000])
    const s = makeScale(data, 'linear', true)
    expect(s.clippedHigh).toBe(true)
    expect(s.hi).toBeLessThan(100)
    expect(s.t(100000)).toBe(1)
    expect(s.t(50)).toBeGreaterThan(0.4)   // without clipping this would be ~0.0005
  })
})

describe('quantile', () => {
  it('interpolates between sorted values', () => {
    expect(quantile([0, 10], 0.25)).toBe(2.5)
    expect(quantile([1, 2, 3], 0.5)).toBe(2)
  })
})
