import { describe, it, expect } from 'vitest'
import { normalizeKana, kindOf } from './municipalities'

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

describe('kindOf', () => {
  it('tells municipalities, special wards, designated-city wards, prefectures and grouping rows apart', () => {
    expect(kindOf({ code: '01303', kanji: '当別町', parent: '' })).toBe('町')
    expect(kindOf({ code: '12220', kanji: '流山市', parent: '' })).toBe('市')
    expect(kindOf({ code: '13101', kanji: '千代田区', parent: '' })).toBe('特別区')
    expect(kindOf({ code: '14131', kanji: '川崎市川崎区', parent: '川崎市' })).toBe('政令市の区')
    expect(kindOf({ code: '14000', kanji: '', parent: '' })).toBe('都道府県')
    expect(kindOf({ code: '01300', kanji: '', parent: '' })).toBe('')
  })
})
