import { describe, it, expect } from 'vitest'
import { describeFilter } from './filterLabel'

describe('describeFilter', () => {
  it('names a prefecture, a kind and &official', () => {
    expect(describeFilter('EQ($prefkanji, "岐阜県")')).toBe('岐阜県')
    expect(describeFilter('&official')).toBe('政令市の区を除く')
    expect(describeFilter('AND(&official, EQ($prefkanji, "岐阜県"))')).toBe('岐阜県・政令市の区を除く')
    expect(describeFilter('AND(EQ($kind, "町"), EQ($prefkanji, "北海道"))')).toBe('町・北海道')
  })

  it('falls back to 条件あり for anything else', () => {
    expect(describeFilter('LEQ(500000, #totalpop)')).toBe('条件あり')
    expect(describeFilter('AND(&official, LEQ(1, #pop_from))')).toBe('条件あり')
    expect(describeFilter('EQ($kanji, "a,b")')).toBe('条件あり')
  })
})
