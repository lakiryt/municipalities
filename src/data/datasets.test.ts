import { describe, it, expect } from 'vitest'
import { parseCsv, toNum, parseCodesCsv, pickEffectiveMinWages } from './datasets'

describe('parseCsv / toNum', () => {
  it('reads the pipeline CSV format, with empty cells as missing values', () => {
    const rows = parseCsv('code,inc0_total,exc0_total\n01101,1380,\n')
    expect(rows).toEqual([{ code: '01101', inc0_total: '1380', exc0_total: '' }])
    expect(toNum(rows[0].inc0_total)).toBe(1380)
    expect(toNum(rows[0].exc0_total)).toBeNaN()
  })

  it('keeps leading zeros in codes and handles quoted fields', () => {
    expect(parseCsv('code,name\r\n01000,"a,b"\r\n')).toEqual([{ code: '01000', name: 'a,b' }])
  })
})

describe('parseCodesCsv', () => {
  it('uses the display name the pipeline already resolved', () => {
    const csv = 'code,name,kana,pref_name,parent_name,group_name\n01303,当別町,とうべつちょう,北海道,,石狩振興局'
    expect(parseCodesCsv(csv)).toEqual([{ code: '01303', kanji: '当別町', kana: 'とうべつちょう', parent: '' }])
  })

  it('keeps a designated-city ward\'s city name', () => {
    const csv = 'code,name,kana,pref_name,parent_name,group_name\n14131,川崎市川崎区,かわさきく,神奈川県,川崎市,'
    expect(parseCodesCsv(csv)[0].parent).toBe('川崎市')
  })
})

describe('pickEffectiveMinWages', () => {
  const newer = [
    { code: '01000', min: 1131, since: '2026-10-01' },
    { code: '05000', min: 1100, since: '2027-03-31' },
  ]
  const older = [
    { code: '01000', min: 1075, since: '2025-10-04' },
    { code: '05000', min: 1031, since: '2026-03-31' },
  ]

  it('takes the new 年度 rate once it has taken effect', () => {
    expect(pickEffectiveMinWages([newer, older], '2026-11-14').get('01')).toEqual({ min: 1131, since: '2026-10-01' })
  })

  it('keeps the previous rate for a prefecture whose new rate starts later', () => {
    expect(pickEffectiveMinWages([newer, older], '2026-11-14').get('05')).toEqual({ min: 1031, since: '2026-03-31' })
  })
})
