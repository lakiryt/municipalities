import { describe, it, expect } from 'vitest'
import { parseCodes } from './codes.mjs'
import { parseBundle } from './area.mjs'
import { ageKey } from './jumin.mjs'
import { pickCensusTables, transform } from './kokusei.mjs'
import { toCode5, checkDigit } from '../lib/code.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { headerLabels } from '../lib/xlsx.mjs'

describe('parseCodes (標準地域コード)', () => {
  // The soumu CSV uses hyphenated headers; older copies used underscores.
  const header = 'ken-code,sityouson-code,tiiki-code,ken-name,sityouson-name1,sityouson-name2,sityouson-name3,yomigana'
  const one = (line) => parseCodes(`${header}\n${line}`)[0]

  it('joins a designated city and its ward into one name', () => {
    expect(one('01,101,01101,北海道,札幌市,,中央区,ちゅうおうく')).toMatchObject({ code: '01101', name: '札幌市中央区', parent_name: '札幌市' })
  })

  it('drops a 郡 grouping label instead of prefixing the municipality name with it', () => {
    expect(one('02,301,02301,青森県,東津軽郡,,平内町,ひらないまち')).toMatchObject({ name: '平内町', group_name: '東津軽郡', parent_name: '' })
  })

  it('drops a Hokkaido 振興局 label the same way', () => {
    expect(one('01,303,01303,北海道,石狩振興局,,当別町,とうべつちょう')).toMatchObject({ name: '当別町', group_name: '石狩振興局' })
  })

  it('drops a Tokyo remote-island 支庁 label the same way', () => {
    expect(one('13,421,13421,東京都,小笠原支庁,,小笠原村,おがさわらむら')).toMatchObject({ name: '小笠原村' })
  })

  it('leaves a plain city as just its own name, and a prefecture row empty', () => {
    expect(one('01,215,01215,北海道,,,美唄市,びばいし')).toMatchObject({ name: '美唄市' })
    expect(one('01,000,01000,北海道,,,,ほっかいどう')).toMatchObject({ name: '', kana: 'ほっかいどう' })
  })

  it('accepts underscore headers too', () => {
    expect(parseCodes(`${header.replace(/-/g, '_')}\n01,215,01215,北海道,,,美唄市,びばいし`)[0].code).toBe('01215')
  })
})

describe('toCode5', () => {
  it('pads 4-digit codes that lost their leading zero', () => {
    expect(toCode5('1100')).toBe('01100')
    expect(toCode5(1100)).toBe('01100')
  })

  it('strips a valid check digit from 6-digit 団体コード', () => {
    expect(toCode5('011002')).toBe('01100')
    expect(toCode5('130001')).toBe('13000')
  })

  it('rejects a 6-digit code with a wrong check digit rather than mis-keying it', () => {
    expect(() => toCode5('011003')).toThrow()
  })

  it('returns null for non-codes', () => {
    expect(toCode5('')).toBeNull()
    expect(toCode5('-')).toBeNull()
    expect(toCode5('全国面積')).toBeNull()
  })

  it('computes JIS check digits', () => {
    expect(checkDigit('01100')).toBe(2)
    expect(checkDigit('47382')).toBe(Number('473821'.slice(-1)))
  })
})

describe('parseEraDate', () => {
  it('handles 元年, missing days, and full-width digits', () => {
    expect(parseEraDate('令和8年7月1日(k㎡)')).toBe('2026-07-01')
    expect(parseEraDate('令和元年7月面積(k㎡)')).toBe('2019-07-01')
    expect(parseEraDate('令和７年1月1日住民基本台帳')).toBe('2025-01-01')
    expect(parseEraDate('昭和31年9月1日')).toBe('1956-09-01')
    expect(parseEraDate('総数')).toBeNull()
  })
})

describe('parseBundle (面積調)', () => {
  const csv = [
    '全国都道府県市区町村別面積調,,,,,,,',
    ',【説明】,,,,,,',
    '標準地域コード,都道府県,郡･支庁･振興局等,市区町村,令和8年7月1日(k㎡),令和8年7月1日備考,令和8年4月1日(k㎡),令和8年4月1日備考',
    '全国面積,,,,377973.68,,377974.87,',
    '1000,北海道,,,83422.23,,83422.22,',
    ',北海道(市部),,,18532.38,（参考値）,18532.38,（参考値）',
    '1100,北海道,,札幌市,1121.26,,1121.25,',
    '47382,沖縄県,八重山郡,与那国町,28.9,（参考値）,,',
  ].join('\n')

  it('splits side-by-side dates into editions and skips non-code rows', () => {
    const eds = parseBundle(csv)
    expect([...eds.keys()]).toEqual(['2026-07-01', '2026-04-01'])
    expect(eds.get('2026-07-01')).toEqual([
      { code: '01000', area: 83422.23, note: '' },
      { code: '01100', area: 1121.26, note: '' },
      { code: '47382', area: 28.9, note: '参考値' },
    ])
  })

  it('reads year-only headers (annual surveys, H26–H30) as October 1', () => {
    const old = [
      '標準地域コード,都道府県,郡･支庁･振興局等,市区町村,平成30年面積(k㎡),平成30年備考',
      '01000,北海道,,,83423.83,',
    ].join('\n')
    expect([...parseBundle(old).keys()]).toEqual(['2018-10-01'])
  })

  it('leaves out a municipality that has no value on a date', () => {
    expect(parseBundle(csv).get('2026-04-01').map(r => r.code)).toEqual(['01000', '01100'])
  })
})

describe('kokusei', () => {
  const t = (id, statsName, title, surveyDate = '202510') => ({ id, statsName, title, surveyDate })

  it('picks the 速報 and 確定 男女別人口 tables and skips 参考表/不詳補完 and other tables', () => {
    const picked = pickCensusTables([
      t('A', '令和７年国勢調査 速報集計 人口速報集計　（男女別人口及び世帯総数）', '男女別人口－全国、都道府県、市区町村'),
      t('B', '令和７年国勢調査 集計結果（原数値） 人口等基本集計', '総人口・総世帯数・男女・年齢・配偶関係 男女別人口－全国、都道府県、市区町村（2000年（平成12年）市区町村含む）'),
      t('C', '令和７年国勢調査 参考表：不詳補完値', '総人口・総世帯数・男女・年齢・配偶関係 男女別人口－全国、都道府県、市区町村（2000年（平成12年）市区町村含む）'),
      t('D', '令和２年国勢調査 速報集計 人口速報集計', '2015年（平成27年）の人口（組替），世帯数', '202010'),
      t('E', '令和２年国勢調査 人口等基本集計', '総人口・総世帯数・男女・年齢・配偶関係 男女別人口－全国，都道府県，市区町村（人口集中地区）', '202010'),
    ])
    expect(picked.map(p => [p.id, p.ref.statsDataId])).toEqual([['2025-sokuho', 'A'], ['2025', 'B']])
    expect(picked[1].label).toBe('令和7年 確定（人口等基本集計）')
  })

  it('drops the 2000-era former municipalities from 確定 tables', () => {
    const v = (area, name, sex, value) => ({ area, time: '2025000000', dims: { tab: '人口', cat01: sex, area: name }, value })
    const { rows } = transform([
      v('01100', '札幌市', '総数', '1961996'), v('01100', '札幌市', '男', '900000'), v('01100', '札幌市', '女', '1061996'),
      v('01305', '（旧：厚田村）', '総数', '1500'),
    ])
    expect(rows).toEqual([{ code: '01100', totalpop: 1961996, malepop: 900000, femalepop: 1061996 }])
  })
})

describe('jumin helpers', () => {
  it('normalizes age-bracket labels across years', () => {
    expect(ageKey('0歳～4歳')).toBe('0_4')
    expect(ageKey('5～9')).toBe('5_9')
    expect(ageKey('100歳以上')).toBe('100_')
    expect(ageKey('総数')).toBeNull()
  })

  it('forward-fills merged header cells except on the last header row', () => {
    const rows = [
      [null, '人口', null, '世帯数'],
      [null, '男', '女', null],
    ]
    expect(headerLabels(rows, 0, 2)).toEqual([[], ['人口', '男'], ['人口', '女'], ['世帯数']])
  })
})
