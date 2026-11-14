// 国勢調査 (e-Stat API). Discovery searches the census's tables
// (getStatsList, 政府統計コード 00200521) for the municipal 男女別人口 table
// of each census, in two flavours:
//   速報: 人口速報集計 「男女別人口－全国，都道府県，市区町村」          → "<year>-sokuho"
//   確定: 人口等基本集計 「…男女別人口－全国，都道府県，市区町村（2000年…）」 → "<year>"
// (参考表 / 不詳補完値 tables share the title and are excluded.) Censuses
// before 2020 name their tables differently; add those to `editions` in
// sources.json by hand if wanted.
import { writeDataCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { toNumber } from '../lib/text.mjs'
import { fetchStatsData, readStatsData, statsList } from '../lib/estat.mjs'
import { fetchRecord } from '../lib/fetch.mjs'

const CENSUS = '00200521'
const eraYear = (y) => y >= 2019 ? `令和${y - 2018 === 1 ? '元' : y - 2018}年` : `平成${y - 1988}年`

// The two kinds of table, by 統計名 and (NFKC, "、"→",") table title.
const KINDS = [
  { suffix: '-sokuho', label: '速報集計', stats: /人口速報集計/, title: /^男女別人口-全国,都道府県,市区町村$/ },
  { suffix: '', label: '確定（人口等基本集計）', stats: /人口等基本集計/, title: /男女別人口-全国,都道府県,市区町村\(2000年/ },
]

/** An edition (and its ref) for one census table. */
const censusEdition = (id, as_of, label, statsDataId) => ({ id, as_of, label, ref: { id, as_of, label, statsDataId } })

/** Picks the 速報/確定 男女別人口 tables out of a getStatsList result. Exported for tests. */
export function pickCensusTables(tables) {
  const out = []
  for (const t of tables) {
    const year = Number(t.surveyDate.slice(0, 4))
    if (!year || /参考表|不詳補完/.test(t.statsName)) continue
    const title = t.title.normalize('NFKC').replace(/、/g, ',')
    const kind = KINDS.find(k => k.stats.test(t.statsName) && k.title.test(title))
    if (kind) out.push(censusEdition(`${year}${kind.suffix}`, `${year}-10-01`, `${eraYear(year)} ${kind.label}`, t.id))
  }
  return out
}

export async function discover(src, opts) {
  const tables = [
    ...await statsList({ statsCode: CENSUS, searchWord: '速報集計 AND 男女別人口' }, opts),
    ...await statsList({ statsCode: CENSUS, searchWord: '人口等基本集計 AND 男女別人口' }, opts),
  ]
  const found = pickCensusTables(tables)
  // Hand-registered extras (e.g. older censuses) — never override a found one.
  for (const e of src.editions ?? []) {
    if (!found.some(f => f.id === e.id)) found.push(censusEdition(e.id, e.as_of, e.label, e.statsDataId))
  }
  return found
}

export async function fetchEdition(src, ref, opts) {
  await fetchStatsData(ref.statsDataId, opts)
}

// Which output column a value belongs to, from its classification names.
// Anything describing change or ratios (増減, 率, 割合) or a non-total
// breakdown we don't keep is ignored.
function columnFor(names) {
  const s = names.join(' ')
  if (/増減|率|割合|密度|面積/.test(s)) return null
  if (/世帯/.test(s)) return 'setai'
  if (/男/.test(s)) return 'malepop'
  if (/女/.test(s)) return 'femalepop'
  if (/総数|総計|^人口$|男女計|人口 ?総数/.test(s) || names.every(n => /人口/.test(n))) return 'totalpop'
  return null
}

export function transform(values) {
  // If the table holds several time points, keep only the newest.
  const latest = values.map(v => v.time).filter(Boolean).sort().at(-1)
  const rows = new Map()
  const ignored = new Set()
  for (const v of values) {
    if (latest && v.time !== latest) continue
    // 確定 tables also carry the 2000-era municipalities as "（旧：厚田村）";
    // they no longer exist and are left out.
    if (/^[（(]旧/.test(v.dims.area ?? '')) continue
    const code = toCode5(v.area)
    if (!code) continue
    const names = Object.entries(v.dims).filter(([k]) => k !== 'area' && k !== 'time').map(([, n]) => n)
    const col = columnFor(names)
    if (!col) { ignored.add(names.join(' / ')); continue }
    const rec = rows.get(code) ?? { code }
    if (rec[col] !== undefined) throw new Error(`国勢調査: ${code} の ${col} に複数の値が対応しました (${names.join(' / ')})。columnFor() を見直してください`)
    rec[col] = toNumber(v.value)
    rows.set(code, rec)
  }
  return { rows: [...rows.values()].sort((a, b) => a.code.localeCompare(b.code)), ignored: [...ignored] }
}

export async function buildEdition(src, ref, opts) {
  const { rows, ignored } = transform(readStatsData(ref.statsDataId))
  if (ignored.length) opts.log(`  note    ${ref.id}: 使わなかった分類: ${ignored.slice(0, 8).join(' | ')}${ignored.length > 8 ? ' …' : ''}`)
  const columns = ['code', 'totalpop', 'malepop', 'femalepop', ...(rows.some(r => r.setai !== undefined) ? ['setai'] : [])]
  const out = writeDataCsv('kokusei', ref.id, columns, rows)
  const rec = fetchRecord(`estat/${ref.statsDataId}/page-1.json`)
  return {
    id: ref.id, as_of: ref.as_of, label: ref.label, ...out,
    source: { url: `e-Stat API statsDataId=${ref.statsDataId}`, retrieved_at: rec?.retrieved_at.slice(0, 10), sha256: rec?.sha256 },
  }
}
