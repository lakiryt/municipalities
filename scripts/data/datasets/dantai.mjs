// 総務省 全国地方公共団体コード: which codes are actual 地方公共団体 (the
// narrower set rankings are restricted to), plus prefecture names/readings.
// Both outputs are bundled into the app (src/assets), so only the latest
// edition is written.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeJson } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { clean } from '../lib/text.mjs'
import { readSheet } from '../lib/xlsx.mjs'
import { ASSETS_DIR, CURATED_DIR } from '../lib/paths.mjs'

const cacheKey = (url) => `dantai/${url.split('/').pop()}`

export async function fetchRaw(src, opts) {
  for (const e of src.editions) await download(e.url, cacheKey(e.url), opts)
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

export async function build(src) {
  // Only the newest edition feeds the app.
  const latest = [...src.editions].sort((a, b) => b.as_of.localeCompare(a.as_of))[0]
  const key = cacheKey(latest.url)
  const { prefectures, municipalities } = parseDantai(readSheet(readCached(key)))

  if (prefectures.length !== 47) throw new Error(`公共団体コード: expected 47 prefectures, got ${prefectures.length}`)
  // URL slugs (/rankings/tokyo/...) — hand-maintained, must never change.
  const romaji = JSON.parse(readFileSync(resolve(CURATED_DIR, 'prefecture-romaji.json'), 'utf-8'))
  const withRomaji = prefectures.map(p => {
    const romanized = romaji[p.code.slice(0, 2)]
    if (!romanized) throw new Error(`prefecture-romaji.json: no entry for ${p.code.slice(0, 2)} (${p.kanji})`)
    return { ...p, romanized }
  })

  const pref = writeJson(resolve(ASSETS_DIR, 'prefectures.json'), withRomaji, { pretty: true })
  const dantai = writeJson(resolve(ASSETS_DIR, 'dantai_codes.json'), municipalities, { pretty: true })
  return {
    editions: [{
      id: latest.as_of, as_of: latest.as_of,
      files: { prefectures: pref.file, municipalities: dantai.file },
      rows: municipalities.length,
      source: provenance(key),
    }],
  }
}
