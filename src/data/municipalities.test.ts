import { describe, it, expect } from 'vitest'
import { normalizeKana } from './municipalities'

describe('normalizeKana', () => {
  it('converts hiragana to full-width katakana', () => {
    expect(normalizeKana('さっぽろし')).toBe('サッポロシ')
  })

  it('converts half-width katakana to full-width katakana', () => {
    expect(normalizeKana('ｻｯﾎﾟﾛｼ')).toBe('サッポロシ')
  })

  it('leaves full-width katakana unchanged', () => {
    expect(normalizeKana('サッポロシ')).toBe('サッポロシ')
  })

  it('produces the same result regardless of the source reading format', () => {
    // The codes source switched from half-width-katakana readings to hiragana
    // ones; every downstream comparison (filters, sort) goes through this
    // function, so both forms must normalize identically or existing saved
    // filter/sort URLs would silently start matching different rows.
    expect(normalizeKana('よこはましつるみく')).toBe(normalizeKana('ﾖｺﾊﾏｼﾂﾙﾐｸ'))
  })
})
