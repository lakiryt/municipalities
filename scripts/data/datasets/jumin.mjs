// 住民基本台帳に基づく人口、人口動態及び世帯数調査 (e-Stat, Excel only).
//
// Each year has two tables: YY-03 【総計】市区町村別人口、人口動態及び世帯数
// ("main") and YY-04 【総計】市区町村別年齢階級別人口 ("age"). They're merged
// into one CSV per year. Layouts drift between years (merged header cells,
// "5歳～9歳" vs "5～9", the 合計 row's code as "-" vs blank), so columns are
// located by their header text, never by position.
import { resolve } from 'node:path'
import { download, readCached, provenance } from '../lib/fetch.mjs'
import { writeCsv } from '../lib/csv.mjs'
import { toCode5 } from '../lib/code.mjs'
import { clean, toNumber } from '../lib/text.mjs'
import { readSheet, headerLabels, findColumn } from '../lib/xlsx.mjs'
import { parseEraDate } from '../lib/era.mjs'
import { PUBLIC_DIR } from '../lib/paths.mjs'

const fileUrl = (id) => `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${id}&fileKind=0`
const cacheKey = (id) => `jumin/${id}.xlsx`

const usable = (e) => e.main && e.age

export async function fetchRaw(src, opts) {
  for (const e of selectEditions(src, opts)) {
    await download(fileUrl(e.main), cacheKey(e.main), opts)
    await download(fileUrl(e.age), cacheKey(e.age), opts)
  }
}

function selectEditions(src, opts) {
  const missing = src.editions.filter(e => !usable(e)).map(e => e.year)
  if (missing.length) opts.log?.(`  skip    ${missing.join(', ')}: statInfId 未設定（\`npm run data -- find jumin --year YYYY\`）`)
  return src.editions.filter(usable).filter(e => !opts.years || opts.years.includes(e.year))
}

// The national-total row has no real code ("-" or blank) but 都道府県名 "合計".
const rowCode = (r) => clean(r[1]).replace(/\*$/, '') === '合計' ? '00000' : toCode5(r[0])

/** First row whose first cell is a code, or whose 都道府県名 is 合計 — everything above is header. */
const firstDataRow = (rows) => rows.findIndex((r, i) => i > 0 && rowCode(r) !== null)
// Row 0 is the table title (one long cell). Header rows start after it —
// including the title would forward-fill "…人口・世帯数…" over every column.
const headerStart = (rows) => rows.findIndex(r => r.filter(c => c !== null && clean(c) !== '').length >= 3)

const MAIN_COLUMNS = {
  malepop:      { parts: ['人口', '男'] },
  femalepop:    { parts: ['人口', '女'] },
  totalpop:     { parts: ['人口', '計'], exclude: ['増減'] },
  setai:        { parts: ['世帯数'] },
  inc_mov_dom:  { parts: ['転入者数(国内)'] },
  inc_mov_intl: { parts: ['転入者数(国外)'] },
  inc_born:     { parts: ['出生者数'] },
  inc_other:    { parts: ['住民票記載数', 'その他(計)'] },
  dec_mov_dom:  { parts: ['転出者数(国内)'] },
  dec_mov_intl: { parts: ['転出者数(国外)'] },
  dec_deaths:   { parts: ['死亡者数'] },
  dec_other:    { parts: ['住民票消除数', 'その他(計)'] },
}
const REQUIRED = new Set(['malepop', 'femalepop', 'totalpop', 'setai'])

/** Parses the "main" table. Returns { asOf, rows: Map<code, record> , missing: string[] }. */
export function parseMain(rows) {
  const asOf = parseEraDate(clean(rows[0][0]))
  const start = firstDataRow(rows)
  const labels = headerLabels(rows, headerStart(rows), start)
  // A column's labels must not mention 増減/率 for the population columns —
  // "増減率" etc. sit under the same merged header in some years.
  const cols = {}, missing = []
  for (const [name, { parts }] of Object.entries(MAIN_COLUMNS)) {
    const filtered = labels.map(ls => ls.some(l => /増減|率/.test(l)) ? [] : ls)
    const i = findColumn(filtered, parts, { optional: !REQUIRED.has(name), what: `${name} (${parts.join(' & ')})` })
    if (i === -1) missing.push(name)
    else cols[name] = i
  }
  const out = new Map()
  for (const r of rows.slice(start)) {
    const code = rowCode(r)
    if (!code) continue
    out.set(code, Object.fromEntries(Object.entries(cols).map(([name, i]) => [name, toNumber(r[i])])))
  }
  return { asOf, rows: out, missing }
}

/** "0歳～4歳" / "0～4歳" / "5～9" → "0_4"; "100歳以上" → "100_"; "総数" → null. */
export function ageKey(label) {
  const s = clean(label)
  let m = s.match(/^(\d+)\D*[～~〜-]\D*(\d+)/)
  if (m) return `${m[1]}_${m[2]}`
  m = s.match(/^(\d+)\s*歳?以上/)
  if (m) return `${m[1]}_`
  return null
}

const SEX = { 計: 'total', 男: 'male', 女: 'female' }

/** Parses the "age" table (3 rows per code: 計/男/女). Returns { asOf, rows: Map<code, record>, ageKeys }. */
export function parseAge(rows) {
  const asOf = parseEraDate(clean(rows[0][0]))
  const start = firstDataRow(rows)
  const labels = headerLabels(rows, headerStart(rows), start)
  const sexCol = findColumn(labels, ['性別'])
  const ageCols = labels.flatMap((ls, i) => {
    const key = ls.map(ageKey).find(Boolean)
    return key ? [{ i, key }] : []
  })
  if (ageCols.length < 10) throw new Error(`年齢階級別: only ${ageCols.length} age columns recognized`)

  const out = new Map()
  for (const r of rows.slice(start)) {
    const code = rowCode(r)
    const sex = SEX[clean(r[sexCol])]
    if (!code || !sex) continue
    const rec = out.get(code) ?? {}
    for (const { i, key } of ageCols) rec[`${sex}${key}`] = toNumber(r[i])
    out.set(code, rec)
  }
  return { asOf, rows: out, ageKeys: ageCols.map(c => c.key) }
}

export async function build(src, opts) {
  const editions = []
  for (const e of selectEditions(src, opts)) {
    const main = parseMain(readSheet(readCached(cacheKey(e.main))))
    const age = parseAge(readSheet(readCached(cacheKey(e.age))))
    if (main.asOf !== age.asOf) throw new Error(`住基 ${e.year}: main (${main.asOf}) and age (${age.asOf}) tables are for different dates`)
    if (main.missing.length) opts.log(`  note    ${e.year}: この年の表に無い列 → 空欄: ${main.missing.join(', ')}`)

    const ageColumns = ['total', 'male', 'female'].flatMap(s => age.ageKeys.map(k => `${s}${k}`))
    const columns = ['code', ...Object.keys(MAIN_COLUMNS), ...ageColumns]
    const codes = [...new Set([...main.rows.keys(), ...age.rows.keys()])].sort()
    const rows = codes.map(code => ({ code, ...main.rows.get(code), ...age.rows.get(code) }))

    const out = writeCsv(resolve(PUBLIC_DIR, `data/jumin/${e.year}.csv`), columns, rows)
    editions.push({
      id: String(e.year), as_of: main.asOf, label: `${e.year}年`,
      path: out.file.replace(/^public\//, ''), rows: out.rows,
      source: [provenance(cacheKey(e.main)), provenance(cacheKey(e.age))],
    })
  }
  // Keep editions not rebuilt this run (e.g. --years filter) from being dropped.
  return { editions, merge: true }
}

// ── statInfId discovery ──────────────────────────────────────────────────────

const LIST_URL = (year) =>
  `https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200241&tstat=000001039591&cycle=7&year=${year}0&month=0&tclass1=000001039601&result_page=1`

/** Scrapes e-Stat's file list for a year and returns { main, age } statInfIds. */
export async function find(src, { year }) {
  if (!year) throw new Error('--year YYYY を指定してください')
  const res = await fetch(LIST_URL(year), { headers: { 'User-Agent': 'municipalities-data-pipeline' } })
  const html = await res.text()
  const items = html.split('stat-dataset_list-item').slice(1).map(s => ({
    id: (s.match(/stat_infid=(\d{12})/) ?? [])[1],
    title: s.replace(/<[^>]+>/g, '\n').split('\n').map(x => x.trim()).find(x => x.includes('【')),
  })).filter(x => x.id && x.title)
  const pick = (re) => items.find(x => re.test(x.title))?.id ?? null
  return {
    year,
    main: pick(/【総計】市区町村別人口、人口動態及び世帯数/),
    age: pick(/【総計】市区町村別年齢階級別人口/),
    all: items,
  }
}
