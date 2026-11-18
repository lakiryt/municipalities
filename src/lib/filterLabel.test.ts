import { describe, it, expect } from 'vitest'
import { parseAndTypeCheck, type TypedBool } from '@/lang/expr'
import { describeFilter } from './filterLabel'

const d = (src: string) => describeFilter(parseAndTypeCheck(src) as TypedBool)

describe('describeFilter', () => {
  it('names a prefecture, a kind and &official', () => {
    expect(d('$prefkanji = "岐阜県"')).toBe('岐阜県')
    expect(d('&official')).toBe('政令市の区を除く')
    expect(d('&official AND $prefkanji = "岐阜県"')).toBe('岐阜県・政令市の区を除く')
    expect(d('$kind = "町" AND $prefkanji = "北海道"')).toBe('町・北海道')
  })

  it('reads the filter, not its text: either notation, either side, any grouping', () => {
    expect(d('AND(&official, EQ($prefkanji, "岐阜県"))')).toBe('岐阜県・政令市の区を除く')
    expect(d('"岐阜県" = $prefkanji')).toBe('岐阜県')
    expect(d('&official AND ($kind = "町" AND $prefkanji = "北海道")')).toBe('町・北海道・政令市の区を除く')
  })

  it('falls back to 条件あり for anything else', () => {
    expect(d('#totalpop >= 500000')).toBe('条件あり')
    expect(d('&official AND #pop_from >= 1')).toBe('条件あり')
    expect(d('$kanji = "a,b"')).toBe('条件あり')
    expect(d('$kind = "町" OR $kind = "村"')).toBe('条件あり')
  })
})
