import { describe, it, expect } from 'vitest'
import { makeScale, suggestScale, quantile, canLog, canDiverge } from './colorScale'

// Mostly decline, some growth, one extreme (+81%) — like a population change rate.
const changeLike = [
  ...Array.from({ length: 500 }, (_, i) => -10 + i * 0.02),
  ...Array.from({ length: 60 }, (_, i) => 0.1 + i * 0.1),
  81,
]

describe('suggestScale', () => {
  it('picks log for positive data spanning orders of magnitude (population, density)', () => {
    expect(suggestScale([5, 50, 500, 5000, 50000, 120, 900, 30])).toBe('log')
  })

  it('picks linear for evenly spread data (rates, rents) and anything non-positive', () => {
    expect(suggestScale([28, 31, 35, 38, 41, 45, 52])).toBe('linear')
    expect(suggestScale([0, 1, 1000, 100000])).toBe('linear')
  })

  it('for data on both sides of 0: symlog when |v| spans orders of magnitude, diverging otherwise', () => {
    expect(suggestScale([-3, 1, 1000, 100000])).toBe('symlog')
    expect(suggestScale(changeLike)).toBe('symlog')
    expect(suggestScale([-3, -2, -1, 1, 2, 3])).toBe('diverging')
    expect(canDiverge([0, 1, 2])).toBe(false)
  })
})

describe('makeScale', () => {
  it('ignores infinite values (a ratio over zero), so every finite value still gets a color', () => {
    const scale = makeScale([1, 2, 3, Infinity, -Infinity, NaN], 'auto')
    expect(scale.lo).toBe(1)
    expect(scale.hi).toBe(3)
    for (const v of [1, 2, 3]) expect(Number.isFinite(scale.t(v))).toBe(true)
  })

  it('diverging puts 0 in the middle and stretches each side to its own extreme', () => {
    const s = makeScale([-20, -10, -5, 0, 2, 4], 'diverging')
    expect(s.t(0)).toBe(0.5)
    expect(s.t(-20)).toBe(0)
    expect(s.t(4)).toBe(1)
    expect(s.t(-10)).toBeCloseTo(0.25)
    expect(s.t(2)).toBeCloseTo(0.75)
    expect(s.valueAt(0.5)).toBe(0)
    expect(s.valueAt(0.25)).toBeCloseTo(-10)
  })

  it('symlog keeps one large value from washing out the rest of its side, without clipping', () => {
    const lin = makeScale(changeLike, 'diverging')
    const sym = makeScale(changeLike, 'symlog')
    expect(lin.t(3)).toBeLessThan(0.53)       // +3% next to +81%: nearly neutral
    expect(sym.t(3)).toBeGreaterThan(lin.t(3) + 0.05)
    expect(sym.t(81)).toBe(1)
    expect(sym.t(0)).toBe(0.5)
    expect(sym.valueAt(sym.t(-4))).toBeCloseTo(-4)
    expect(sym.clippedHigh).toBe(false)
  })

  it('clipping means the same on a signed scale: p% off each end of all values', () => {
    const s = makeScale(changeLike, 'diverging', 2)
    expect(s.clippedHigh).toBe(true)
    expect(s.hi).toBeLessThan(10)
    expect(s.t(81)).toBe(1)
    // Fewer than 2% of values are positive here → the positive side is all
    // "outside" and drawn in its end color.
    const few = makeScale([...Array.from({ length: 200 }, (_, i) => -1 - i), 5], 'diverging', 2)
    expect(few.hi).toBe(0)
    expect(few.t(5)).toBe(1)
  })

  const values = [1, 10, 100, 1000, 10000]

  it('linear maps min..max to 0..1', () => {
    const s = makeScale(values, 'linear')
    expect(s.t(1)).toBe(0)
    expect(s.t(10000)).toBe(1)
    expect(s.t(5000.5)).toBeCloseTo(0.5)
  })

  it('log spaces each order of magnitude evenly', () => {
    const s = makeScale(values, 'log')
    expect(s.t(100)).toBeCloseTo(0.5)
    expect(s.valueAt(0.25)).toBeCloseTo(10)
  })

  it('falls back to linear when log or a signed scale is impossible', () => {
    expect(canLog([0, 1, 2])).toBe(false)
    expect(makeScale([0, 1, 2], 'log').kind).toBe('linear')
    expect(makeScale([0, 1, 2], 'symlog').kind).toBe('linear')
  })

  it('allows a few zeros on a log scale, painting them in the lowest color', () => {
    const data = [0, ...Array.from({ length: 40 }, (_, i) => 10 ** (i / 10))]
    expect(canLog(data)).toBe(true)
    expect(suggestScale(data)).toBe('log')
    const s = makeScale(data, 'auto')
    expect(s.kind).toBe('log')
    expect(s.lo).toBe(1)
    expect(s.clippedLow).toBe(true)   // the legend shows "≤ 1"
    expect(s.t(0)).toBe(0)
  })

  it('rank spreads values evenly regardless of their size, with ties sharing a position', () => {
    const s = makeScale([1, 2, 2, 1000], 'rank')
    expect(s.t(1)).toBe(0)
    expect(s.t(2)).toBeCloseTo(0.5)
    expect(s.t(1000)).toBe(1)
  })

  it('clip takes the given percentage off each end and clamps the rest to the ends', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1).concat([100000])
    const s = makeScale(data, 'linear', 2)
    expect(s.clippedHigh).toBe(true)
    expect(s.hi).toBeLessThan(100)
    expect(s.t(100000)).toBe(1)
    expect(s.t(50)).toBeGreaterThan(0.4)   // without clipping this would be ~0.0005
    const wider = makeScale(data, 'linear', 10)
    expect(wider.hi).toBeLessThan(s.hi)
    expect(makeScale(data, 'linear', 0).clippedHigh).toBe(false)
  })
})

describe('quantile', () => {
  it('interpolates between sorted values', () => {
    expect(quantile([0, 10], 0.25)).toBe(2.5)
    expect(quantile([1, 2, 3], 0.5)).toBe(2)
  })
})
