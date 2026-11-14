// 国土地理院 全国都道府県市区町村別面積調.
//
// Each CSV bundles many survey dates side by side: after 4 ID columns come
// ("<date>(k㎡)", "<date>備考") pairs, newest first. Discovery downloads the
// (small) bundles linked from the publisher's pages and lists every date in
// them; an edition is one date, built from whichever bundle has it.
// Rows without a numeric code are subtotals (北海道(市部)), lakes, or the
// national total and are skipped.
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { decodeText, toNumber, clean } from '../lib/text.mjs'
import { parseCsv, writeDataCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { pageHtml, links } from '../lib/discover.mjs'

const cacheKey = (url) => `area/${url.split('/').pop()}`

export async function discover(src, opts) {
  const bundleUrls = []
  for (const page of src.discover_pages) {
    for (const l of links(await pageHtml(page, opts), page)) {
      if (/_mencho\.csv$/i.test(l.url) && !bundleUrls.includes(l.url)) bundleUrls.push(l.url)
    }
  }
  if (bundleUrls.length === 0) throw new Error('面積調の CSV へのリンクが見つかりません（ページ構成が変わった可能性）')
  const editions = new Map()
  for (const url of bundleUrls) {
    // Re-download every time: the newest bundle is replaced as dates are added.
    const buf = await download(url, cacheKey(url), { ...opts, force: true })
    for (const asOf of parseBundle(decodeText(buf)).keys()) {
      if (!editions.has(asOf)) editions.set(asOf, { id: asOf, as_of: asOf, label: asOf, ref: { url, as_of: asOf } })
    }
  }
  return [...editions.values()]
}

export async function fetchEdition(src, ref, opts) {
  await download(ref.url, cacheKey(ref.url), opts)
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
    // H26–H30 were surveyed once a year, as of October 1, and their headers
    // carry only the year ("平成30年面積(k㎡)").
    const asOf = parseEraDate(header[i]) ?? parseEraDate(header[i].replace(/^((?:令和|平成)\s*(?:元|\d+)\s*年)/, '$110月1日'))
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

export async function buildEdition(src, ref) {
  const key = cacheKey(ref.url)
  const rows = parseBundle(decodeText(readCached(key))).get(ref.as_of)
  if (!rows) throw new Error(`面積: ${ref.url} に ${ref.as_of} の列がありません`)
  rows.sort((a, b) => a.code.localeCompare(b.code))
  const out = writeDataCsv('area', ref.as_of, ['code', 'area', 'note'], rows)
  return { id: ref.as_of, as_of: ref.as_of, ...out, source: provenance(key) }
}
