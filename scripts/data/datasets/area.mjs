// 国土地理院 全国都道府県市区町村別面積調.
//
// Each CSV bundles many survey dates side by side: after 4 ID columns come
// ("<date>(k㎡)", "<date>備考") pairs, newest first. One download therefore
// yields every quarterly edition in that range. Rows without a numeric code
// are subtotals (北海道(市部)), lakes, or the national total and are skipped.
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { decodeText, toNumber, clean } from '../lib/text.mjs'
import { parseCsv, writeCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { PUBLIC_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `area/${url.split('/').pop()}`

export async function fetchRaw(src, opts) {
  for (const f of src.files) await download(f.url, cacheKey(f.url), opts)
}

/** Parses one bundled CSV into Map<as_of, rows[]>. Exported for tests. */
export function parseBundle(text) {
  const rows = parseCsv(text)
  const headerIdx = rows.findIndex(r => clean(r[0]) === '標準地域コード')
  if (headerIdx === -1) throw new Error('面積調 CSV: header row (標準地域コード) not found')
  const header = rows[headerIdx]

  const dateCols = []
  for (let i = 4; i < header.length; i++) {
    // NFKC folds "k㎡" to "km2".
    if (!header[i].normalize('NFKC').includes('km2')) continue
    const asOf = parseEraDate(header[i])
    if (!asOf) throw new Error(`面積調 CSV: can't read a date from column header "${header[i]}"`)
    const noteIdx = clean(header[i + 1]).endsWith('備考') ? i + 1 : -1
    dateCols.push({ asOf, valueIdx: i, noteIdx })
  }
  if (dateCols.length === 0) throw new Error('面積調 CSV: no date columns found')

  const editions = new Map(dateCols.map(d => [d.asOf, []]))
  for (const r of rows.slice(headerIdx + 1)) {
    const code = toCode5(r[0])
    if (!code) continue
    for (const d of dateCols) {
      const area = toNumber(r[d.valueIdx])
      // A blank cell means the municipality didn't exist on that date.
      if (area === null) continue
      const note = d.noteIdx === -1 ? '' : clean(r[d.noteIdx]).replace(/^（|）$|^\(|\)$/g, '')
      editions.get(d.asOf).push({ code, area, note })
    }
  }
  return editions
}

export async function build(src) {
  const from = src.editions?.from ?? '0000-00-00'
  const byDate = new Map()   // as_of → { rows, cacheKey }
  // Files are listed newest first; if two files share a date, the newer file wins.
  for (const f of src.files) {
    const key = cacheKey(f.url)
    for (const [asOf, rows] of parseBundle(decodeText(readCached(key)))) {
      if (asOf < from || byDate.has(asOf)) continue
      byDate.set(asOf, { rows, key })
    }
  }

  const editions = []
  for (const [asOf, { rows, key }] of byDate) {
    rows.sort((a, b) => a.code.localeCompare(b.code))
    const out = writeCsv(resolve(PUBLIC_DIR, `data/area/${asOf}.csv`), ['code', 'area', 'note'], rows)
    editions.push({ id: asOf, as_of: asOf, path: out.file.replace(/^public\//, ''), rows: out.rows, source: provenance(key) })
  }
  return { editions }
}
