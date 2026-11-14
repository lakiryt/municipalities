// 厚生労働省 地域別最低賃金改定状況: one xlsx with every 年度 since H14 as
// (改定額, 発効年月日) column pairs, one row per prefecture. Prefectures are
// written with spacing ("青　森", "茨　城　"), so they're matched to codes by
// name against the prefecture list, never by row order.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeCsv } from '../lib/csv.mjs'
import { clean, toNumber } from '../lib/text.mjs'
import { readSheet, excelDate } from '../lib/xlsx.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { ASSETS_DIR, PUBLIC_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `minwage/${url.split('/').pop()}`

export async function fetchRaw(src, opts) {
  await download(src.url, cacheKey(src.url), opts)
}

const squash = (s) => clean(s).replace(/\s/g, '')

/** "北海道" / "青森県" / "東京都" / "大阪府" → "北海道" / "青森" / "東京" / "大阪". */
const shortName = (kanji) => kanji === '北海道' ? kanji : kanji.replace(/[都府県]$/, '')

export function parseMinWage(rows, prefectures) {
  const yearRow = rows.findIndex(r => squash(r[0]) === '年度')
  if (yearRow === -1) throw new Error('最低賃金 xlsx: 年度 row not found')
  const years = []
  rows[yearRow].forEach((label, i) => {
    if (i === 0 || !label) return
    // "令和８年度" → 2026 (年度 starts in April; the label's year is what we key on).
    const d = parseEraDate(`${clean(label).replace('年度', '年')}4月1日`)
    if (d) years.push({ year: Number(d.slice(0, 4)), amountIdx: i, sinceIdx: i + 1 })
  })

  const byName = new Map(prefectures.map(p => [shortName(p.kanji), p.code]))
  const out = new Map(years.map(y => [y.year, []]))
  for (const r of rows.slice(yearRow + 2)) {
    const code = byName.get(squash(r[0]))
    if (!code) continue
    for (const y of years) {
      const min = toNumber(r[y.amountIdx])
      if (min === null) continue
      out.get(y.year).push({ code, min, since: excelDate(r[y.sinceIdx]) })
    }
  }
  for (const [year, list] of out) {
    if (list.length !== 47) throw new Error(`最低賃金 ${year}年度: expected 47 prefectures, got ${list.length}`)
  }
  return out
}

export async function build(src) {
  const prefectures = JSON.parse(readFileSync(resolve(ASSETS_DIR, 'prefectures.json'), 'utf-8'))
  const key = cacheKey(src.url)
  const byYear = parseMinWage(readSheet(readCached(key)), prefectures)
  const from = src.editions?.from ?? 0
  const editions = []
  for (const [year, rows] of byYear) {
    if (year < from) continue
    rows.sort((a, b) => a.code.localeCompare(b.code))
    const out = writeCsv(resolve(PUBLIC_DIR, `data/minwage/${year}.csv`), ['code', 'min', 'since'], rows)
    // The 年度's edition date: when the last prefecture's new rate took effect.
    const asOf = rows.map(r => r.since).filter(Boolean).sort().at(-1)
    editions.push({
      id: String(year), as_of: asOf, label: `${year}年度`,
      path: out.file.replace(/^public\//, ''), rows: out.rows, source: provenance(key),
    })
  }
  return { editions }
}
