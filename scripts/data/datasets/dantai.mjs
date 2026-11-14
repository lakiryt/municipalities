// 総務省 全国地方公共団体コード: which codes are actual 地方公共団体 (the
// narrower set rankings are restricted to), plus prefecture names/readings.
// Both outputs are bundled into the app (src/assets), so the repo holds a
// single edition (`single` in sources.json).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeRepoJson } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { clean } from '../lib/text.mjs'
import { readSheet } from '../lib/xlsx.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { pageHtml, links } from '../lib/discover.mjs'
import { ASSETS_DIR, CURATED_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `dantai/${url.split('/').pop()}`

export async function discover(src, opts) {
  const html = await pageHtml(src.page, opts)
  // 「都道府県コード及び市区町村コード」（令和6年1月1日更新） … PDF … Excel.
  // The similarly named 改正一覧表 is followed by 改正一覧表, not （…更新）.
  const m = html.match(/「都道府県コード及び市区町村コード」(?:\s|<[^>]+>)*[（(]\s*((?:令和|平成)[^）)]*?)更新\s*[）)]/)
  const asOf = m && parseEraDate(m[1])
  if (!asOf) throw new Error('公共団体コード: 更新日が読み取れません（ページ構成が変わった可能性）')
  const xlsx = links(html, src.page).find(l => l.index > m.index && /\.xlsx?$/i.test(l.url))
  if (!xlsx) throw new Error('公共団体コード: Excel へのリンクが見つかりません')
  return [{ id: asOf, as_of: asOf, label: asOf, ref: { url: xlsx.url, as_of: asOf } }]
}

export async function fetchEdition(src, ref, opts) {
  await download(ref.url, cacheKey(ref.url), opts)
}

/** Sheet 1 rows: [団体コード(6桁), 都道府県名, 市区町村名, 都道府県カナ, 市区町村カナ]. */
export function parseDantai(rows) {
  const headerIdx = rows.findIndex(r => clean(r[0]) === '団体コード')
  if (headerIdx === -1) throw new Error('公共団体コード xlsx: header row (団体コード) not found')
  const data = rows.slice(headerIdx + 1).filter(r => r[0] !== null && clean(r[0]) !== '')
  const prefectures = [], municipalities = []
  for (const r of data) {
    const code = toCode5(r[0])
    if (!code) throw new Error(`公共団体コード xlsx: bad code "${r[0]}"`)
    if (clean(r[2])) municipalities.push(code)
    else prefectures.push({ code, kanji: clean(r[1]), kana: clean(r[3]) })
  }
  return { prefectures, municipalities }
}

export async function buildEdition(src, ref) {
  const key = cacheKey(ref.url)
  const { prefectures, municipalities } = parseDantai(readSheet(readCached(key)))

  if (prefectures.length !== 47) throw new Error(`公共団体コード: expected 47 prefectures, got ${prefectures.length}`)
  // URL slugs (/rankings/tokyo/...) — hand-maintained, must never change.
  const romaji = JSON.parse(readFileSync(resolve(CURATED_DIR, 'prefecture-romaji.json'), 'utf-8'))
  const withRomaji = prefectures.map(p => {
    const romanized = romaji[p.code.slice(0, 2)]
    if (!romanized) throw new Error(`prefecture-romaji.json: no entry for ${p.code.slice(0, 2)} (${p.kanji})`)
    return { ...p, romanized }
  })

  const files = {
    prefectures: writeRepoJson(resolve(ASSETS_DIR, 'prefectures.json'), withRomaji),
    municipalities: writeRepoJson(resolve(ASSETS_DIR, 'dantai_codes.json'), municipalities),
  }
  return {
    id: ref.as_of, as_of: ref.as_of,
    files,
    rows: municipalities.length,
    source: provenance(key),
  }
}
