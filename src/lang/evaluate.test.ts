import { describe, it, expect } from 'vitest'
import { evaluate, blankEnv, keeps, type Env } from './evaluate'
import { parseAndTypeCheck, type TypedBool } from './expr'
import { nodata, DIVZERO, OVERFLOW, type Finite, type Value } from './value'

const n = (v: number) => v as Finite
const blank = blankEnv()
const baseEnv: Env = {
  numvars: { ...blank.numvars, totalpop: n(100), area: n(4), femalepop: n(60), malepop: n(40), setai: n(0) },
  strvars: { ...blank.strvars, kanji: '東京都', prefkanji: '東京都' },
  boolvars: { ...blank.boolvars, seirei: true, official: false },
}
const ev = (src: string, env: Env = baseEnv): Value => evaluate(parseAndTypeCheck(src), env)

describe('numeric evaluation', () => {
  it('evaluates SUM/MULT/NEG/INV', () => {
    expect(ev('SUM(#femalepop, #malepop)')).toBe(100)
    expect(ev('MULT(#area, 2)')).toBe(8)
    expect(ev('NEG(#area)')).toBe(-4)
    expect(ev('INV(#area)')).toBe(0.25)
  })

  it('evaluates MIN and MAX', () => {
    expect(ev('MIN(#femalepop, #malepop, 10)')).toBe(10)
    expect(ev('MAX(#femalepop, #malepop, 10)')).toBe(60)
  })

  it('evaluates ROUND, with negative digits for tens, hundreds, …', () => {
    expect(ev('ROUND(#totalpop / #area, 2)')).toBe(25)
    expect(ev('ROUND(1234.5678, 2)')).toBe(1234.57)
    expect(ev('ROUND(1234.5678, -2)')).toBe(1200)
  })

  it('IF picks a branch', () => {
    expect(ev('IF(&seirei, 1, 2)')).toBe(1)
  })
})

describe('missing values say why', () => {
  it('a variable the data has none for is nodata, naming the variable', () => {
    expect(ev('#rent_private')).toEqual(nodata('#rent_private'))
    expect(ev('$prefkana')).toEqual(nodata('$prefkana'))
    expect(ev('&coastal')).toEqual(nodata('&coastal'))
  })

  it('dividing by zero is divzero, whatever is divided', () => {
    expect(ev('#totalpop / #setai')).toEqual(DIVZERO)
    expect(ev('0 / 0')).toEqual(DIVZERO)
    expect(ev('INV(0)')).toEqual(DIVZERO)
  })

  it('a result too large for a number is overflow', () => {
    const big = '9'.repeat(300)
    expect(ev(`${big} * ${big}`)).toEqual(OVERFLOW)
    expect(ev(`${big} + ${big}`)).toBe(2e300)   // large, but still a number
  })

  it('an operation on a missing value is missing for the same reason', () => {
    expect(ev('#rent_private * 30')).toEqual(nodata('#rent_private'))
    expect(ev('-#rent_private')).toEqual(nodata('#rent_private'))
    expect(ev('ROUND(#rent_private, 1)')).toEqual(nodata('#rent_private'))
    expect(ev('MIN(#rent_private, 1)')).toEqual(nodata('#rent_private'))
    expect(ev('SUBSTR($prefkana, 1)')).toEqual(nodata('$prefkana'))
  })

  it('missing data outranks a division by zero, in either order', () => {
    expect(ev('#rent_private + #totalpop / #setai')).toEqual(nodata('#rent_private'))
    expect(ev('#totalpop / #setai + #rent_private')).toEqual(nodata('#rent_private'))
  })

  it('IF with a missing condition is missing; an unchosen branch does not matter', () => {
    expect(ev('IF(&coastal, 1, 2)')).toEqual(nodata('&coastal'))
    expect(ev('IF(&seirei, 1, #rent_private)')).toBe(1)
  })

  it('a derived-looking ratio of present values is a number', () => {
    expect(ev('#femalepop / #malepop')).toBe(1.5)
  })
})

describe('three-valued logic', () => {
  const T = '&seirei', F = '&official', M = '&coastal'   // true, false, missing
  const missing = nodata('&coastal')

  it('AND: false wins, then missing', () => {
    expect(ev(`${T} AND ${T}`)).toBe(true)
    expect(ev(`${T} AND ${F}`)).toBe(false)
    expect(ev(`${M} AND ${F}`)).toBe(false)
    expect(ev(`${F} AND ${M}`)).toBe(false)
    expect(ev(`${T} AND ${M}`)).toEqual(missing)
  })

  it('OR: true wins, then missing', () => {
    expect(ev(`${F} OR ${F}`)).toBe(false)
    expect(ev(`${M} OR ${T}`)).toBe(true)
    expect(ev(`${T} OR ${M}`)).toBe(true)
    expect(ev(`${F} OR ${M}`)).toEqual(missing)
  })

  it('NOT of missing is missing', () => {
    expect(ev(`NOT(${M})`)).toEqual(missing)
    expect(ev(`NOT(${T})`)).toBe(false)
  })

  it('a comparison with a missing side is missing, as is its negation', () => {
    for (const op of ['<', '<=', '>', '>=', '=', '!=']) {
      expect(ev(`#rent_private ${op} 1`)).toEqual(nodata('#rent_private'))
      expect(ev(`1 ${op} #totalpop / #setai`)).toEqual(DIVZERO)
    }
    expect(ev('$prefkana = "x"')).toEqual(nodata('$prefkana'))
  })

  it('comparisons of present values', () => {
    expect(ev('#femalepop < #malepop')).toBe(false)
    expect(ev('#femalepop > #malepop')).toBe(true)
    expect(ev('#area < 4')).toBe(false)
    expect(ev('#area <= 4')).toBe(true)
    expect(ev('#area != 4')).toBe(false)
    expect(ev('$kanji = $prefkanji')).toBe(true)
  })

  it('a filter keeps a row only when its condition is true', () => {
    const f = (src: string) => keeps(parseAndTypeCheck(src) as TypedBool, baseEnv)
    expect(f('#totalpop >= 100')).toBe(true)
    // A missing value never passes, whichever way the condition is written.
    expect(f('#rent_private < 1000')).toBe(false)
    expect(f('#rent_private >= 1000')).toBe(false)
    expect(f('NOT(#rent_private >= 1000)')).toBe(false)
    expect(f('#rent_private != 0')).toBe(false)
    // …unless the condition doesn't depend on it.
    expect(f('#rent_private < 1000 OR &seirei')).toBe(true)
  })
})

describe('@id column references', () => {
  it('resolves a colref through a chain (column referencing base vars only, per the no-column-to-column-refs invariant)', () => {
    const columns = [
      { id: 0, typed: parseAndTypeCheck('#femalepop') },
      { id: 1, typed: parseAndTypeCheck('#malepop') },
    ]
    const expr = parseAndTypeCheck('LEQ(@0, @1)', [{ id: 0, type: 'n' }, { id: 1, type: 'n' }])
    expect(evaluate(expr, { ...baseEnv, columns })).toBe(false) // 60 <= 40 is false
  })

  it('a dangling colref (column deleted) is missing instead of throwing', () => {
    const danglingRef = { type: 'n' as const, expr: { kind: 'colref' as const, id: 99 } }
    expect(evaluate(danglingRef, { ...baseEnv, columns: [] })).toEqual(nodata('@99'))
  })
})

describe('strings', () => {
  it('SUBSTR takes from the start, or with a negative length from the end', () => {
    expect(ev('SUBSTR($kanji, 1)')).toBe('東')
    expect(ev('SUBSTR($kanji, -1)')).toBe('都')
  })
})
