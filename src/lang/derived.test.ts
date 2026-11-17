import { describe, it, expect } from 'vitest'
import { checkDerived, DERIVED_DEFS } from './derived'

describe('derived variables', () => {
  it('the declared ones pass: each uses only earlier ones', () => {
    expect(DERIVED_DEFS.length).toBeGreaterThan(0)
  })

  it('a use of a later one, or of itself, is an error rather than a value never computed', () => {
    expect(() => checkDerived([
      { name: 'inc_net', expr: '#inc - #dec' },
      { name: 'inc', expr: '#inc_born' },
      { name: 'dec', expr: '#dec_deaths' },
    ])).toThrow(/#inc_net.*#inc\b/)
    expect(() => checkDerived([{ name: 'inc', expr: '#inc + 1' }])).toThrow(/#inc/)
  })

  it('a derived variable must be a number', () => {
    expect(() => checkDerived([{ name: 'inc', expr: '&seirei' }])).toThrow(/数値/)
  })
})
