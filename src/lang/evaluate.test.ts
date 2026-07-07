import { describe, it, expect } from 'vitest'
import { evaluate, type Env } from './evaluate'
import { parseAndTypeCheck } from './expr'

const baseEnv: Env = {
  numvars: { totalpop: 100, area: 4, female: 60, male: 40 },
  strvars: { kanji: '東京都', prefkanji: '東京都' },
  boolvars: { seirei: true },
}

describe('numeric evaluation', () => {
  it('evaluates SUM/MULT/NEG/INV', () => {
    expect(evaluate(parseAndTypeCheck('SUM(#female, #male)'), baseEnv)).toBe(100)
    expect(evaluate(parseAndTypeCheck('MULT(#area, 2)'), baseEnv)).toBe(8)
    expect(evaluate(parseAndTypeCheck('NEG(#area)'), baseEnv)).toBe(-4)
    expect(evaluate(parseAndTypeCheck('INV(#area)'), baseEnv)).toBe(0.25)
  })

  it('evaluates MIN and MAX', () => {
    expect(evaluate(parseAndTypeCheck('MIN(#female, #male, 10)'), baseEnv)).toBe(10)
    expect(evaluate(parseAndTypeCheck('MAX(#female, #male, 10)'), baseEnv)).toBe(60)
  })

  it('MIN/MAX with no arguments matches JS Math.min/max identity (+/-Infinity)', () => {
    expect(evaluate(parseAndTypeCheck('MIN()'), baseEnv)).toBe(Infinity)
    expect(evaluate(parseAndTypeCheck('MAX()'), baseEnv)).toBe(-Infinity)
  })

  it('evaluates ROUND', () => {
    expect(evaluate(parseAndTypeCheck('ROUND(MULT(#totalpop, INV(#area)), 2)'), baseEnv)).toBe(25)
  })

  it('an unknown numvar evaluates to NaN', () => {
    expect(evaluate(parseAndTypeCheck('#missing'), baseEnv)).toBeNaN()
  })

  it('evaluates IF', () => {
    expect(evaluate(parseAndTypeCheck('IF(&seirei, 1, 2)'), baseEnv)).toBe(1)
  })
})

describe('boolean evaluation', () => {
  it('evaluates AND/OR/NOT/LEQ', () => {
    expect(evaluate(parseAndTypeCheck('AND(&seirei, LEQ(#area, 10))'), baseEnv)).toBe(true)
    expect(evaluate(parseAndTypeCheck('NOT(&seirei)'), baseEnv)).toBe(false)
    expect(evaluate(parseAndTypeCheck('OR(NOT(&seirei), LEQ(1, 2))'), baseEnv)).toBe(true)
  })

  it('evaluates EQ across matching types', () => {
    expect(evaluate(parseAndTypeCheck('EQ($kanji, $prefkanji)'), baseEnv)).toBe(true)
    expect(evaluate(parseAndTypeCheck('EQ(1, 2)'), baseEnv)).toBe(false)
  })

  it('an unknown boolvar evaluates to false', () => {
    expect(evaluate(parseAndTypeCheck('&missing'), baseEnv)).toBe(false)
  })
})

describe('string evaluation', () => {
  it('evaluates SUBSTR with positive and negative length', () => {
    // There's no negative-literal syntax in the language — NEG(1) is how
    // you write -1 (bare `-1` fails to tokenize).
    expect(evaluate(parseAndTypeCheck('SUBSTR($kanji, 1)'), baseEnv)).toBe('東')
    expect(evaluate(parseAndTypeCheck('SUBSTR($kanji, NEG(1))'), baseEnv)).toBe('都')
  })

  it('an unknown strvar evaluates to empty string', () => {
    expect(evaluate(parseAndTypeCheck('$missing'), baseEnv)).toBe('')
  })
})

describe('@id column references', () => {
  it('resolves a colref by evaluating the referenced column against the same env', () => {
    const columns = [{ id: 0, typed: parseAndTypeCheck('SUM(#female, #male)') }]
    const sortExpr = parseAndTypeCheck('@0', [{ id: 0, type: 'n' }])
    expect(evaluate(sortExpr, { ...baseEnv, columns })).toBe(100)
  })

  it('resolves a colref through a chain (column referencing base vars only, per the no-column-to-column-refs invariant)', () => {
    const columns = [
      { id: 0, typed: parseAndTypeCheck('#female') },
      { id: 1, typed: parseAndTypeCheck('#male') },
    ]
    const expr = parseAndTypeCheck('LEQ(@0, @1)', [{ id: 0, type: 'n' }, { id: 1, type: 'n' }])
    expect(evaluate(expr, { ...baseEnv, columns })).toBe(false) // 60 <= 40 is false
  })

  it('a dangling colref (column deleted) evaluates to a safe default instead of throwing', () => {
    const danglingRef = { type: 'n' as const, expr: { kind: 'colref' as const, id: 99 } }
    expect(evaluate(danglingRef, { ...baseEnv, columns: [] })).toBeNaN()
  })

  it('without a columns env at all, a colref evaluates to a safe default', () => {
    const ref = { type: 'b' as const, expr: { kind: 'colref' as const, id: 0 } }
    expect(evaluate(ref, baseEnv)).toBe(false)
  })
})
