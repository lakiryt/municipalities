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

// "0_総数" → total, … The leading number is the category code.
const TENURE = { 0: 'total', 1: 'public', 2: 'ur', 3: 'private', 4: 'company' }
const COLUMNS = ['code', ...['inc0', 'exc0'].flatMap(z => Object.values(TENURE).map(t => `${z}_${t}`))]

export function parseRent(rows) {
  // Header rows are labelled in column 2 (表章項目/事項名/項目名/表章単位).
  const itemRow = rows.find(r => clean(r[2]) === '項目名')
  if (!itemRow) throw new Error('家賃 xlsx: 項目名 row not found')
  const labels = itemRow.map(c => [clean(c)])
  const inc0 = findColumn(labels, ['家賃0円を含む'])
  const exc0 = findColumn(labels, ['家賃0円を含まない'])

  const out = new Map()
  for (const r of rows) {
    const m = clean(r[1]).match(/^(\d{5})_/)
    const t = clean(r[2]).match(/^(\d)_/)
    if (!m || !t || !TENURE[t[1]]) continue
    const code = toCode5(m[1])
    const rec = out.get(code) ?? { code }
    // "-" (no such homes, or too few to report) → blank.
    rec[`inc0_${TENURE[t[1]]}`] = toNumber(r[inc0])
    rec[`exc0_${TENURE[t[1]]}`] = toNumber(r[exc0])
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
