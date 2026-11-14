// 住宅・土地統計調査 延べ面積1m²当たり家賃 (e-Stat Excel). Editions are
// registered by hand in sources.json (one survey every 5 years); `discover`
// checks each registered file is still listed on e-Stat.
// Five rows per area (住宅の所有の関係: 総数/公営/UR・公社/民営/給与住宅), with
// the average rent per m² both including and excluding zero-rent homes.
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { clean, toNumber } from '../lib/text.mjs'
import { readSheet, findColumn } from '../lib/xlsx.mjs'
import { pageHtml } from '../lib/discover.mjs'
import { PUBLIC_DIR } from '../lib/paths.mjs'

const fileUrl = (id) => `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${id}&fileKind=0`
const cacheKey = (id) => `rent/${id}.xlsx`

export async function discover(src, opts) {
  const out = []
  for (const e of src.editions) {
    const html = await pageHtml(`https://www.e-stat.go.jp/stat-search/files?stat_infid=${e.statInfId}`, opts)
    out.push({ id: e.id, as_of: e.as_of, label: e.label, ref: { ...e }, available: html.includes(`statInfId=${e.statInfId}`) })
  }
  return out
}

export async function fetchEdition(src, ref, opts) {
  await download(fileUrl(ref.statInfId), cacheKey(ref.statInfId), opts)
}

// 住宅の所有の関係, matched by name: the category codes differ between
// surveys ("0_総数"/"1_公営の借家" in 2023, "00_総数"/"10_公営の借家" in 2018).
const TENURE = [
  [/総数/, 'total'], [/公営/, 'public'], [/都市再生機構|UR|公社/, 'ur'], [/民営/, 'private'], [/給与/, 'company'],
]
const tenureOf = (cell) => {
  const m = clean(cell).match(/^\d{1,2}_(.+)$/)
  return m ? TENURE.find(([re]) => re.test(m[1]))?.[1] ?? null : null
}
const COLUMNS = ['code', ...['inc0', 'exc0'].flatMap(z => TENURE.map(([, t]) => `${z}_${t}`))]

/**
 * Column positions also differ between surveys (2018 has extra leading
 * columns), so the two value columns are found by their item labels and the
 * area/tenure columns by their contents ("13101_千代田区", "30_民営借家").
 */
export function parseRent(rows) {
  const itemRow = rows.find(r => r.some(c => clean(c) === '1_家賃0円を含む'))
  if (!itemRow) throw new Error('家賃 xlsx: 「1_家賃0円を含む」の見出し行が見つかりません')
  const labels = itemRow.map(c => [clean(c)])
  const inc0 = findColumn(labels, ['家賃0円を含む'])
  const exc0 = findColumn(labels, ['家賃0円を含まない'])

  const out = new Map()
  for (const r of rows) {
    const areaCell = r.find(c => /^\d{5}_/.test(clean(c)))
    const tenure = areaCell && r.map(tenureOf).find(Boolean)
    if (!areaCell || !tenure) continue
    const code = toCode5(clean(areaCell).slice(0, 5))
    const rec = out.get(code) ?? { code }
    // "-" (no such homes, or too few to report) → blank.
    rec[`inc0_${tenure}`] = toNumber(r[inc0])
    rec[`exc0_${tenure}`] = toNumber(r[exc0])
    out.set(code, rec)
  }
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export async function buildEdition(src, ref) {
  const rows = parseRent(readSheet(readCached(cacheKey(ref.statInfId))))
  const out = writeCsv(resolve(PUBLIC_DIR, `data/rent/${ref.id}.csv`), COLUMNS, rows)
  return {
    id: ref.id, as_of: ref.as_of, published: ref.published, label: ref.label,
    path: out.file.replace(/^public\//, ''), rows: out.rows, source: provenance(cacheKey(ref.statInfId)),
  }
}
