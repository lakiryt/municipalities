import { describe, it, expect } from 'vitest'
import { parseAndTypeCheck, referencesColumn, ParseError, TypeCheckError } from './expr'

describe('literals and variables', () => {
  it('parses a numeric literal', () => {
    expect(parseAndTypeCheck('42')).toEqual({ type: 'n', expr: { kind: 'literal', value: 42 } })
  })

  it('parses a decimal literal', () => {
    expect(parseAndTypeCheck('3.5')).toEqual({ type: 'n', expr: { kind: 'literal', value: 3.5 } })
  })

  it('parses a numvar', () => {
    expect(parseAndTypeCheck('#totalpop')).toEqual({ type: 'n', expr: { kind: 'numvar', name: 'totalpop' } })
  })

  it('parses a strvar', () => {
    expect(parseAndTypeCheck('$kanji')).toEqual({ type: 's', expr: { kind: 'strvar', name: 'kanji' } })
  })

  it('parses a boolvar', () => {
    expect(parseAndTypeCheck('&seirei')).toEqual({ type: 'b', expr: { kind: 'boolvar', name: 'seirei' } })
  })

  it('parses a string literal', () => {
    expect(parseAndTypeCheck('"東京都"')).toEqual({ type: 's', expr: { kind: 'strlit', value: '東京都' } })
  })

  it('rejects an empty numvar name', () => {
    expect(() => parseAndTypeCheck('#')).toThrow(ParseError)
  })

  it('rejects an unterminated string literal', () => {
    expect(() => parseAndTypeCheck('"abc')).toThrow(ParseError)
  })

  it('rejects an unknown character', () => {
    expect(() => parseAndTypeCheck('%')).toThrow(ParseError)
  })
})

describe('function calls', () => {
  it('type-checks SUM over numvars', () => {
    const t = parseAndTypeCheck('SUM(#female, #male)')
    expect(t.type).toBe('n')
  })

  it('type-checks MIN and MAX over numvars, variadic like SUM/MULT', () => {
    expect(parseAndTypeCheck('MIN(#female, #male)').type).toBe('n')
    expect(parseAndTypeCheck('MAX(#female, #male, 100)').type).toBe('n')
  })

  it('rejects a non-numeric argument to MIN/MAX', () => {
    expect(() => parseAndTypeCheck('MIN(1, "x")')).toThrow(TypeCheckError)
    expect(() => parseAndTypeCheck('MAX(&seirei)')).toThrow(TypeCheckError)
  })

  it('rejects wrong arity', () => {
    expect(() => parseAndTypeCheck('NEG(1, 2)')).toThrow(TypeCheckError)
  })

  it('rejects a type mismatch in AND', () => {
    expect(() => parseAndTypeCheck('AND(1, &seirei)')).toThrow(TypeCheckError)
  })

  it('rejects EQ with mismatched operand types', () => {
    expect(() => parseAndTypeCheck('EQ(1, "1")')).toThrow(TypeCheckError)
  })

  it('accepts EQ with matching operand types', () => {
    expect(parseAndTypeCheck('EQ(1, 2)').type).toBe('b')
  })

  it('rejects an unknown function name', () => {
    expect(() => parseAndTypeCheck('NOPE(1)')).toThrow(TypeCheckError)
  })

  it('unclosed call is a parse error', () => {
    expect(() => parseAndTypeCheck('SUM(1, 2')).toThrow(ParseError)
  })

  it('IF requires matching branch types', () => {
    expect(() => parseAndTypeCheck('IF(&seirei, 1, "x")')).toThrow(TypeCheckError)
  })

  it('IF resolves to the branch type when they match', () => {
    expect(parseAndTypeCheck('IF(&seirei, 1, 2)').type).toBe('n')
  })

  it('SUBSTR requires a string then a number', () => {
    expect(parseAndTypeCheck('SUBSTR($kanji, 2)').type).toBe('s')
    expect(() => parseAndTypeCheck('SUBSTR(1, 2)')).toThrow(TypeCheckError)
  })
})

describe('@id column references', () => {
  it('rejects @id when no column context is given (column-expression position)', () => {
    expect(() => parseAndTypeCheck('@0')).toThrow(TypeCheckError)
  })

  it('rejects a bare @ with no digits', () => {
    expect(() => parseAndTypeCheck('@')).toThrow(ParseError)
  })

  it('resolves to the referenced column\'s type when context is given', () => {
    expect(parseAndTypeCheck('@0', [{ id: 0, type: 'n' }])).toEqual({ type: 'n', expr: { kind: 'colref', id: 0 } })
    expect(parseAndTypeCheck('@1', [{ id: 1, type: 'b' }])).toEqual({ type: 'b', expr: { kind: 'colref', id: 1 } })
    expect(parseAndTypeCheck('@2', [{ id: 2, type: 's' }])).toEqual({ type: 's', expr: { kind: 'colref', id: 2 } })
  })

  it('rejects a reference to an id not present in the context', () => {
    expect(() => parseAndTypeCheck('@5', [{ id: 0, type: 'n' }])).toThrow(TypeCheckError)
  })

  it('is usable as an argument inside a call, given context', () => {
    const t = parseAndTypeCheck('LEQ(@0, 100)', [{ id: 0, type: 'n' }])
    expect(t.type).toBe('b')
  })

  it('a reference id is independent of array position (ids need not be 0-based/contiguous)', () => {
    expect(parseAndTypeCheck('@7', [{ id: 7, type: 'n' }]).type).toBe('n')
  })
})

describe('referencesColumn', () => {
  it('finds a direct reference', () => {
    const t = parseAndTypeCheck('@3', [{ id: 3, type: 'n' }])
    expect(referencesColumn(t, 3)).toBe(true)
    expect(referencesColumn(t, 4)).toBe(false)
  })

  it('finds a reference nested inside a call (used for warning before deleting a referenced column)', () => {
    const t = parseAndTypeCheck('LEQ(@3, 100000)', [{ id: 3, type: 'n' }])
    expect(referencesColumn(t, 3)).toBe(true)
  })

  it('finds a reference nested inside AND/OR/NOT/IF', () => {
    const t = parseAndTypeCheck('AND(NOT(&seirei), IF(@0, &seirei, NOT(&seirei)))', [{ id: 0, type: 'b' }])
    // @0 is used as the IF condition here, not as a plain boolvar
    expect(referencesColumn(t, 0)).toBe(true)
  })

  it('finds a reference on either side of EQ regardless of type', () => {
    const t = parseAndTypeCheck('EQ($kanji, @0)', [{ id: 0, type: 's' }])
    expect(referencesColumn(t, 0)).toBe(true)
  })

  it('finds a reference inside SUBSTR', () => {
    const t = parseAndTypeCheck('SUBSTR(@0, 2)', [{ id: 0, type: 's' }])
    expect(referencesColumn(t, 0)).toBe(true)
  })

  it('returns false when the expression has no column references at all', () => {
    const t = parseAndTypeCheck('LEQ(#totalpop, 100000)')
    expect(referencesColumn(t, 0)).toBe(false)
  })

  it('does not confuse a string literal that happens to contain "@3" with an actual reference', () => {
    const t = parseAndTypeCheck('EQ($kanji, "@3")')
    expect(referencesColumn(t, 3)).toBe(false)
  })
})
