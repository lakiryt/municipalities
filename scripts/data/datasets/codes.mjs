// 総務省 統計局 標準地域コード: names and readings for every prefecture,
// municipality, designated-city ward, and grouping row (郡/振興局/支庁).
// The publisher only offers the latest version.
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { decodeText, clean } from '../lib/text.mjs'
import { parseCsv, writeCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { pageHtml, links, stripTags } from '../lib/discover.mjs'
import { PUBLIC_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `codes/${url.split('/').pop()}`

export async function discover(src, opts) {
  const html = await pageHtml(src.page, opts)
  const csv = links(html, src.page).find(l => /\.csv$/i.test(l.url) && l.text.includes('全国'))
  if (!csv) throw new Error('標準地域コード: 全国 CSV へのリンクが見つかりません')
  const m = stripTags(html).match(/((?:令和|平成)\s*\S+?年\s*\d+\s*月\s*\d+\s*日)\s*更新/)
  const asOf = m && parseEraDate(m[1])
  if (!asOf) throw new Error('標準地域コード: 更新日が読み取れません')
  return [{ id: asOf, as_of: asOf, label: asOf, ref: { url: csv.url, as_of: asOf } }]
}

export async function fetchEdition(src, ref, opts) {
  await download(ref.url, cacheKey(ref.url), opts)
}

// `sityouson-name1`/`name3` double up for two unrelated relationships: a
// designated city's own name + its ward's name (札幌市 + 北区, both part of the
// full name), and a grouping label + the actual municipality's name
// (石狩振興局 + 当別町, 東津軽郡 + 平内町) where the label isn't part of the name
// at all. Only 郡/振興局/支庁 labels are the latter — real parent names all end
// in 市 — so this suffix check tells them apart.
const GROUPING_LABEL_SUFFIXES = ['郡', '振興局', '支庁']
export const isGroupingLabel = (name1) => GROUPING_LABEL_SUFFIXES.some(s => name1.endsWith(s))

/**
 * One output row per CSV row. `name` is the display name the app uses:
 * "札幌市中央区" for a ward, "当別町" (no 振興局 prefix) for a town, and
 * empty for a prefecture's own row (the app falls back to the prefecture name).
 */
export function parseCodes(text) {
  const [header, ...rows] = parseCsv(text).filter(r => r.some(c => c !== ''))
  const col = (name) => {
    const i = header.findIndex(h => clean(h).replace(/[-_]/g, '') === name)
    if (i === -1) throw new Error(`標準地域コード CSV: column ${name} not found in ${header.join(',')}`)
    return i
  }
  const [iCode, iPref, iName1, iName2, iName3, iKana] =
    ['tiikicode', 'kenname', 'sityousonname1', 'sityousonname2', 'sityousonname3', 'yomigana'].map(col)

  return rows.map(r => {
    const name1 = clean(r[iName1]), name2 = clean(r[iName2]), name3 = clean(r[iName3])
    const grouping = isGroupingLabel(name1)
    const parts = grouping ? [name3] : [name1, name2, name3]
    return {
      code: toCode5(r[iCode]),
      name: parts.filter(Boolean).join(''),
      kana: clean(r[iKana]).normalize('NFC'),
      pref_name: clean(r[iPref]),
      parent_name: !grouping && name3 ? name1 : '',
      group_name: grouping ? name1 : '',
    }
  })
}

export async function buildEdition(src, ref) {
  const key = cacheKey(ref.url)
  const rows = parseCodes(decodeText(readCached(key)))
  const out = writeCsv(resolve(PUBLIC_DIR, `data/codes/${ref.as_of}.csv`),
    ['code', 'name', 'kana', 'pref_name', 'parent_name', 'group_name'], rows)
  return { id: ref.as_of, as_of: ref.as_of, path: out.file.replace(/^public\//, ''), rows: out.rows, source: provenance(key) }
}
