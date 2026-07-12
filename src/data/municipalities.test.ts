import { describe, it, expect } from 'vitest'
import { normalizeKana, suppressedToNaN, parseCodesCsv } from './municipalities'

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

describe('suppressedToNaN', () => {
  it('passes real values through unchanged', () => {
    expect(suppressedToNaN(1329)).toBe(1329)
    expect(suppressedToNaN(0)).toBe(0)
  })

  it('treats a suppressed (-1) value as NaN', () => {
    expect(suppressedToNaN(-1)).toBeNaN()
  })

  it('treats a missing value as NaN', () => {
    expect(suppressedToNaN(undefined)).toBeNaN()
  })
})

describe('parseCodesCsv', () => {
  const header = 'ken_code,sityouson_code,tiiki_code,ken_name,sityouson_name1,sityouson_name2,sityouson_name3,yomigana'

  it('joins a designated city and its ward into one name', () => {
    const csv = `${header}\n01,101,01101,北海道,札幌市,,中央区,ちゅうおうく`
    expect(parseCodesCsv(csv)).toEqual([{ code: '01101', kanji: '札幌市中央区', kana: 'ちゅうおうく' }])
  })

  it('drops a 郡 grouping label instead of prefixing the municipality name with it', () => {
    const csv = `${header}\n02,301,02301,青森県,東津軽郡,,平内町,ひらないまち`
    expect(parseCodesCsv(csv)).toEqual([{ code: '02301', kanji: '平内町', kana: 'ひらないまち' }])
  })

  it('drops a Hokkaido 振興局/総合振興局 grouping label the same way', () => {
    const csv = `${header}\n01,303,01303,北海道,石狩振興局,,当別町,とうべつちょう`
    expect(parseCodesCsv(csv)).toEqual([{ code: '01303', kanji: '当別町', kana: 'とうべつちょう' }])
  })

  it('drops a Tokyo remote-island 支庁 grouping label the same way', () => {
    const csv = `${header}\n13,421,13421,東京都,小笠原支庁,,小笠原村,おがさわらむら`
    expect(parseCodesCsv(csv)).toEqual([{ code: '13421', kanji: '小笠原村', kana: 'おがさわらむら' }])
  })

  it('leaves a plain city with no ward as just its own name', () => {
    const csv = `${header}\n01,215,01215,北海道,,,美唄市,びばいし`
    expect(parseCodesCsv(csv)).toEqual([{ code: '01215', kanji: '美唄市', kana: 'びばいし' }])
  })
})
