import { describe, it, expect } from 'vitest'
import { parseAndTypeCheck, referencesColumn, ParseError, TypeCheckError, type ColumnTypeInfo } from './expr'
import { evaluate, blankEnv } from './evaluate'
import { VAR_COMPLETIONS } from './variables'

describe('literals and variables', () => {
  it('rejects a variable that is not declared (a typo is an error, not a column of NaN)', () => {
    expect(() => parseAndTypeCheck('#rent_privat')).toThrow(TypeCheckError)
    expect(() => parseAndTypeCheck('$kanjii')).toThrow(TypeCheckError)
    expect(() => parseAndTypeCheck('&offical')).toThrow(TypeCheckError)
    expect(() => parseAndTypeCheck('SUM(#totalpop, #totalpopp)')).toThrow(/#totalpopp/)
  })

  it('accepts every declared variable, derived ones included', () => {
    for (const v of VAR_COMPLETIONS) expect(() => parseAndTypeCheck(v)).not.toThrow()
  })

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
    const t = parseAndTypeCheck('SUM(#femalepop, #malepop)')
    expect(t.type).toBe('n')
  })

  it('type-checks MIN and MAX over numvars, variadic like SUM/MULT', () => {
    expect(parseAndTypeCheck('MIN(#femalepop, #malepop)').type).toBe('n')
    expect(parseAndTypeCheck('MAX(#femalepop, #malepop, 100)').type).toBe('n')
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

describe('operators', () => {
  // An operator is notation for a core function: both spellings are the same tree.
  const same = (infix: string, prefix: string, columns?: ColumnTypeInfo[]) =>
    expect(parseAndTypeCheck(infix, columns)).toEqual(parseAndTypeCheck(prefix, columns))

  it('are the core functions they stand for', () => {
    same('#malepop + #femalepop', 'SUM(#malepop, #femalepop)')
    same('#inc - #dec', 'SUM(#inc, NEG(#dec))')
    same('#totalpop * 2', 'MULT(#totalpop, 2)')
    same('#totalpop / #area', 'MULT(#totalpop, INV(#area))')
    same('#totalpop <= 100000', 'LEQ(#totalpop, 100000)')
    same('#totalpop >= 100000', 'LEQ(100000, #totalpop)')
    same('$prefkanji = "東京都"', 'EQ($prefkanji, "東京都")')
    same('$kind != "市"', 'NOT(EQ($kind, "市"))')
    same('&seirei AND &coastal', 'AND(&seirei, &coastal)')
    same('&seirei OR &chukaku', 'OR(&seirei, &chukaku)')
  })

  it('make one call of a chain, left to right', () => {
    same('#area + #setai + #minwage', 'SUM(#area, #setai, #minwage)')
    same('#area + #setai - #minwage', 'SUM(#area, #setai, NEG(#minwage))')
    same('#area / #setai * #minwage', 'MULT(#area, INV(#setai), #minwage)')
    same('&seirei OR &chukaku OR &tokurei', 'OR(&seirei, &chukaku, &tokurei)')
    // A parenthesized right side stays its own sum (the order of addition is kept).
    same('#area + (#setai + #minwage)', 'SUM(#area, SUM(#setai, #minwage))')
    // A function written out is not merged with an operator.
    same('SUM(#area, #setai) + #minwage', 'SUM(SUM(#area, #setai), #minwage)')
  })

  it('bind by the usual precedence', () => {
    same('#area + #setai * #minwage', 'SUM(#area, MULT(#setai, #minwage))')
    same('(#area + #setai) * #minwage', 'MULT(SUM(#area, #setai), #minwage)')
    same('#area - #setai - #minwage', 'SUM(#area, NEG(#setai), NEG(#minwage))')
    same('#area * 2 <= #setai + 1', 'LEQ(MULT(#area, 2), SUM(#setai, 1))')
    same('&seirei OR &chukaku AND &coastal', 'OR(&seirei, AND(&chukaku, &coastal))')
    same('#area <= 1 AND $kind = "市"', 'AND(LEQ(#area, 1), EQ($kind, "市"))')
  })

  it('a leading minus negates; on a number it is the negative number', () => {
    expect(parseAndTypeCheck('-3')).toEqual({ type: 'n', expr: { kind: 'literal', value: -3 } })
    same('ROUND(#area, -2)', 'ROUND(#area, -2)')
    same('-#area * #setai', 'MULT(NEG(#area), #setai)')
    same('#area - -1', 'SUM(#area, NEG(-1))')
  })

  it('mix with functions and column references', () => {
    same('ROUND(#totalpop / #area, 2)', 'ROUND(MULT(#totalpop, INV(#area)), 2)')
    same('IF(&seirei, #area * 2, #area)', 'IF(&seirei, MULT(#area, 2), #area)')
    same('@0 >= 10 AND @1', 'AND(LEQ(10, @0), @1)', [{ id: 0, type: 'n' }, { id: 1, type: 'b' }])
  })

  it('evaluate as the arithmetic they look like', () => {
    const t = parseAndTypeCheck('(1 + 2) * 3 - 4 / 2')
    expect(evaluate(t, blankEnv())).toBe(7)
  })

  it('comparisons do not chain', () => {
    expect(() => parseAndTypeCheck('1 <= #area <= 2')).toThrow(ParseError)
    expect(() => parseAndTypeCheck('#area = 1 = &seirei')).toThrow(ParseError)
    expect(parseAndTypeCheck('(#area = 1) = &seirei').type).toBe('b')
  })

  it('< and > are not offered (NOT(b <= a) would pass a missing value)', () => {
    expect(() => parseAndTypeCheck('#area < 1')).toThrow(ParseError)
    expect(() => parseAndTypeCheck('#area > 1')).toThrow(ParseError)
  })

  it('reject a dangling or misplaced operator', () => {
    expect(() => parseAndTypeCheck('#area +')).toThrow(ParseError)
    expect(() => parseAndTypeCheck('* #area')).toThrow(ParseError)
    expect(() => parseAndTypeCheck('(#area + 1')).toThrow(ParseError)
    expect(() => parseAndTypeCheck('#area #setai')).toThrow(ParseError)
  })

  it('a type error names the operator written, not the function behind it', () => {
    expect(() => parseAndTypeCheck('#area + "x"')).toThrow(/足し算・引き算の項/)
    expect(() => parseAndTypeCheck('#area / $kanji')).toThrow(/割り算の項/)
    expect(() => parseAndTypeCheck('&seirei AND 1')).toThrow(/「AND」の項/)
    expect(() => parseAndTypeCheck('#area = "x"')).toThrow(/「=」: 両辺の型/)
  })
})
