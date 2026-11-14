// 厚生労働省 地域別最低賃金改定状況: one xlsx with every 年度 since H14 as
// (改定額, 発効年月日) column pairs, one row per prefecture. Discovery finds
// the xlsx on the publisher's page and lists every 年度 in it. Prefectures
// are padded with full-width spaces (青, U+3000, 森 — "青森" written as three
// characters), so they're matched to codes by name against the prefecture
// list, never by row order.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeDataCsv } from '../lib/csv.mjs'
import { clean, toNumber } from '../lib/text.mjs'
import { readSheet, excelDate } from '../lib/xlsx.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { pageHtml, links } from '../lib/discover.mjs'
import { ASSETS_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `minwage/${url.split('/').pop()}`
const prefectures = () => JSON.parse(readFileSync(resolve(ASSETS_DIR, 'prefectures.json'), 'utf-8'))

export async function discover(src, opts) {
  const xlsx = links(await pageHtml(src.page, opts), src.page).find(l => /\.xlsx$/i.test(l.url) && l.text.includes('改定状況'))
  if (!xlsx) throw new Error('最低賃金: 「…改定状況」xlsx へのリンクが見つかりません')
  const buf = await download(xlsx.url, cacheKey(xlsx.url), { ...opts, force: true })
  return [...readMinWage(buf)].map(([year, rows]) => ({
    id: String(year), as_of: asOfOf(rows), label: `${year}年度`, ref: { year, url: xlsx.url },
  }))
}

export async function fetchEdition(src, ref, opts) {
  await download(ref.url, cacheKey(ref.url), opts)
}

const squash = (s) => clean(s).replace(/\s/g, '')

/** "北海道" / "青森県" / "東京都" / "大阪府" → "北海道" / "青森" / "東京" / "大阪". */
const shortName = (kanji) => kanji === '北海道' ? kanji : kanji.replace(/[都府県]$/, '')

// The 年度's edition date: when the last prefecture's new rate took effect.
const asOfOf = (rows) => rows.map(r => r.since).filter(Boolean).sort().at(-1)

/** Map<year, [{ code, min, since }]> for every 年度 in the sheet. Exported for tests. */
export function parseMinWage(rows, prefs) {
  const yearRow = rows.findIndex(r => squash(r[0]) === '年度')
  if (yearRow === -1) throw new Error('最低賃金 xlsx: 年度 row not found')
  const years = []
  rows[yearRow].forEach((label, i) => {
    if (i === 0 || !label) return
    // "令和８年度" → 2026 (年度 starts in April; the label's year is what we key on).
    const d = parseEraDate(`${clean(label).replace('年度', '年')}4月1日`)
    if (d) years.push({ year: Number(d.slice(0, 4)), amountIdx: i, sinceIdx: i + 1 })
  })

  const byName = new Map(prefs.map(p => [shortName(p.kanji), p.code]))
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
  return out
}

/** Parses the xlsx and insists every 年度 names all 47 prefectures (else a name didn't match). */
function readMinWage(buf) {
  const byYear = parseMinWage(readSheet(buf), prefectures())
  for (const [year, list] of byYear) {
    if (list.length !== 47) throw new Error(`最低賃金 ${year}年度: 47都道府県のはずが ${list.length} 件（都道府県名の照合漏れ）`)
  }
  return byYear
}

export async function buildEdition(src, ref) {
  const key = cacheKey(ref.url)
  const rows = readMinWage(readCached(key)).get(ref.year)
  if (!rows) throw new Error(`最低賃金: ${ref.url} に ${ref.year}年度がありません`)
  rows.sort((a, b) => a.code.localeCompare(b.code))
  const out = writeDataCsv('minwage', ref.year, ['code', 'min', 'since'], rows)
  return {
    id: String(ref.year), as_of: asOfOf(rows), label: `${ref.year}年度`,
    ...out, source: provenance(key),
  }
}
