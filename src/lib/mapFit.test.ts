import { describe, it, expect } from 'vitest'
import { fitBounds } from './mapFit'

const box = (x: number, y: number, size = 2) => ({ x0: x, y0: y, x1: x + size, y1: y + size })

describe('fitBounds', () => {
  it('is the union of the boxes when they form one cluster', () => {
    expect(fitBounds([box(0, 0), box(4, 0), box(0, 4), box(4, 4)])).toEqual({ x0: 0, y0: 0, x1: 6, y1: 6 })
  })

  it('leaves out a far-away outlier (remote islands)', () => {
    const mainland = Array.from({ length: 20 }, (_, i) => box(i % 5 * 2, Math.floor(i / 5) * 2))
    const fit = fitBounds([...mainland, box(5, 400)])
    expect(fit!.y1).toBeLessThan(20)
  })

  it('returns null for nothing to fit', () => {
    expect(fitBounds([])).toBeNull()
  })
})
