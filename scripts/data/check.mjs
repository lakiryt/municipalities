// Consistency checks over what the repo holds (meta.json and the files it
// points at), compared with the publishers' catalog where one exists.
//   error = the data is broken (bad codes, missing files, totals that don't add up,
//           nothing enabled for the app)
//   warn  = worth a look (coverage dropped, a newer edition upstream)
//   info  = FYI (big jumps between editions — usually real; an edition we hold
//           is no longer published)
// Used by `npm run data -- check` and the management UI.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseCsv } from './lib/csv.mjs'
import { readMeta, readManifest } from './lib/meta.mjs'
import { readCatalog } from './lib/catalog.mjs'
import { editionFiles, missingEditions } from './lib/editions.mjs'
import { ASSETS_DIR, PUBLIC_DIR, CHECK_REPORT_PATH, rel } from './lib/paths.mjs'

// Datasets keyed by municipality, and the column that should be filled for
// (nearly) every official municipality.
const MUNICIPAL = { jumin: 'totalpop', kokusei: 'totalpop', area: 'area', rent: 'inc0_total' }
// Minimum share of official municipalities with a value (rent covers only
// the larger ones, so it has none).
const MIN_COVERAGE = { jumin: 0.99, kokusei: 0.99, area: 0.99 }
// Max relative change between consecutive editions before warning.
const JUMP = { jumin: 0.2, kokusei: 0.2, area: 0.05 }
// Totals: exact for population; area is rounded per row, so allow 0.5%.
const TOTAL_TOLERANCE = { jumin: 0, kokusei: 0, area: 0.005 }
// Used only before the publishers have been checked (no catalog): how old the
// latest edition can get (days) before a newer one has probably appeared.
const STALE_AFTER_DAYS = { area: 200, jumin: 600, minwage: 400, rent: 365 * 6, designations: 365 * 2, map: 550 }

const readCsvRows = (path) => {
  const [header, ...rows] = parseCsv(readFileSync(path, 'utf-8')).filter(r => r.length > 1 || r[0] !== '')
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}
const num = (v) => (v === '' || v === undefined ? null : Number(v))
const round = (n) => Math.round(n * 100) / 100
const sample = (list, n = 4) => `${list.slice(0, n).join(', ')}${list.length > n ? ' …' : ''}`

// Editions are compared with the previous one of the same series: "2025" with
// "2020", "2025-sokuho" with "2020-sokuho" — never a 速報 with a 確定.
const seriesOf = (id) => id.replace(/^\d{4}(-\d{2}-\d{2})?/, '')

export async function runChecks() {
  const meta = readMeta()
  const manifest = readManifest()
  const catalog = readCatalog()
  const results = []
  const add = (level, dataset, edition, message) => results.push({ level, dataset, edition, message })

  const officialPath = resolve(ASSETS_DIR, 'dantai_codes.json')
  const official = existsSync(officialPath) ? new Set(JSON.parse(readFileSync(officialPath, 'utf-8'))) : new Set()
  if (official.size === 0) add('error', 'dantai', null, 'dantai_codes.json がありません')

  for (const [id, src] of Object.entries(manifest)) {
    const ds = meta.datasets[id]
    if (!ds?.editions?.length) { add('warn', id, null, '未取得（リポジトリに版がありません）'); continue }
    checkHoldings(id, src, ds, catalog.datasets[id], add)

    const previous = new Map()   // series → rows by code, walking oldest → newest
    for (const e of [...ds.editions].reverse()) {
      const missing = editionFiles(e).filter(f => !existsSync(f))
      if (missing.length) { add('error', id, e.id, `ファイルがありません: ${missing.map(rel).join(', ')}`); continue }
      if (id === 'map') { checkMap(e, meta, add); continue }
      if (!e.path?.endsWith('.csv')) continue

      const rows = readCsvRows(resolve(PUBLIC_DIR, e.path))
      checkCodes(id, e, rows, add)
      const col = MUNICIPAL[id]
      if (!col) continue
      const byCode = new Map(rows.map(r => [r.code, r]))
      checkCoverage(id, e, byCode, official, col, add)
      if (TOTAL_TOLERANCE[id] !== undefined) checkTotals(id, e, byCode, official, col, TOTAL_TOLERANCE[id], add)
      const prev = previous.get(seriesOf(e.id))
      if (prev && JUMP[id]) checkJumps(id, e, prev, byCode, official, col, add)
      previous.set(seriesOf(e.id), byCode)
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    errors: results.filter(r => r.level === 'error').length,
    warnings: results.filter(r => r.level === 'warn').length,
    catalog_checked_at: catalog.checked_at ?? null,
    results,
  }
  mkdirSync(dirname(CHECK_REPORT_PATH), { recursive: true })
  writeFileSync(CHECK_REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
  return report
}

/** C: something enabled for the app. A vs B: newer editions upstream, editions no longer published. */
function checkHoldings(id, src, ds, cat, add) {
  if (!ds.editions.some(e => e.enabled !== false)) add('error', id, null, '有効な版がありません（アプリがこのデータを読めません）')

  if (!cat) {
    const latest = ds.editions[0]
    const ref = id === 'designations' ? latest.checked_at : latest.as_of
    const limit = STALE_AFTER_DAYS[id]
    const age = ref ? (Date.now() - Date.parse(ref)) / 86400e3 : 0
    if (limit && age > limit) add('warn', id, latest.id, `最新版が ${Math.round(age)} 日前（${ref}）。「配布元を確認」してください`)
    return
  }
  if (cat.error) add('warn', id, null, `配布元の確認に失敗: ${cat.error}`)
  const newer = missingEditions(id, { newerOnly: true })
  if (newer.length) add('warn', id, null, `配布元に保持していない新しい版があります: ${newer.map(e => e.id).join(', ')}`)
  if (src.discover !== 'curated' && !cat.error) {
    const published = new Set(cat.editions.filter(e => e.available !== false).map(e => e.id))
    const gone = ds.editions.filter(e => !published.has(e.id)).map(e => e.id)
    if (gone.length) add('info', id, null, `配布元から無くなった版を保持しています: ${gone.join(', ')}`)
  }
}

/** Every row keyed by a unique 5-digit code. */
function checkCodes(id, e, rows, add) {
  const bad = rows.filter(r => !/^\d{5}$/.test(r.code ?? ''))
  if (bad.length) add('error', id, e.id, `5桁でないコード ${bad.length} 件（例: ${sample(bad.map(r => r.code), 3)}）`)
  const seen = new Set(), dup = new Set()
  for (const r of rows) (seen.has(r.code) ? dup : seen).add(r.code)
  if (dup.size) add('error', id, e.id, `重複コード ${dup.size} 件（例: ${sample([...dup], 3)}）`)
}

/** Share of official municipalities with a value — drops after mergers or misparsed files. */
function checkCoverage(id, e, byCode, official, col, add) {
  const covered = [...official].filter(c => num(byCode.get(c)?.[col]) !== null).length
  const pct = official.size ? covered / official.size : 0
  const level = MIN_COVERAGE[id] && pct < MIN_COVERAGE[id] ? 'warn' : 'ok'
  add(level, id, e.id, `公共団体 ${official.size} 件中 ${covered} 件に値あり（${(pct * 100).toFixed(1)}%）`)
}

/** Municipalities add up to their prefecture, prefectures to the national total. */
function checkTotals(id, e, byCode, official, col, tolerance, add) {
  const close = (a, b) => Math.abs(a - b) <= Math.max(tolerance * Math.abs(b), tolerance ? 0.5 : 0)
  const valueOf = (c) => num(byCode.get(c)?.[col]) ?? 0
  const prefs = [...byCode.keys()].filter(c => /^\d\d000$/.test(c) && c !== '00000')
  const problems = []
  const national = num(byCode.get('00000')?.[col])
  if (national !== null) {
    const sum = prefs.reduce((s, c) => s + valueOf(c), 0)
    if (!close(sum, national)) problems.push(`都道府県の合計 ${round(sum)} ≠ 全国 ${national}`)
  }
  for (const p of prefs) {
    const pv = num(byCode.get(p)[col])
    if (pv === null) continue
    const sum = [...official].filter(c => c.startsWith(p.slice(0, 2))).reduce((s, c) => s + valueOf(c), 0)
    if (!close(sum, pv)) problems.push(`${p}: 市区町村の合計 ${round(sum)} ≠ ${pv}`)
  }
  if (problems.length) add(tolerance ? 'warn' : 'error', id, e.id, `合計が合いません: ${sample(problems)}`)
  else add('ok', id, e.id, '合計の検算 OK（市区町村→都道府県→全国）')
}

/** Large changes from the previous edition of the same series (real, or a parsing slip). */
function checkJumps(id, e, prev, byCode, official, col, add) {
  const jumps = []
  for (const c of official) {
    const a = num(prev.get(c)?.[col]), b = num(byCode.get(c)?.[col])
    if (a && b && Math.abs(b - a) / a > JUMP[id]) jumps.push(`${c}: ${a}→${b}`)
  }
  if (jumps.length) add('info', id, e.id, `前の版から ±${JUMP[id] * 100}% 超の変化 ${jumps.length} 件（${sample(jumps)}）`)
}

/** Every drawn code exists in the 標準地域コード the app uses. */
function checkMap(e, meta, add) {
  const topo = JSON.parse(readFileSync(resolve(PUBLIC_DIR, e.path), 'utf-8'))
  const mapCodes = new Set(Object.values(topo.objects)[0].geometries.filter(g => g.type).map(g => g.properties.code))
  const codesEd = meta.datasets.codes?.editions?.find(x => x.enabled !== false)
  if (!codesEd) return
  const known = new Set(readCsvRows(resolve(PUBLIC_DIR, codesEd.path)).map(r => r.code))
  const unknown = [...mapCodes].filter(c => !known.has(c))
  if (unknown.length) add('warn', 'map', e.id, `標準地域コードにないコードの図形 ${unknown.length} 件（${sample(unknown, 5)}）`)
  else add('ok', 'map', e.id, `図形 ${mapCodes.size} コード、すべて標準地域コードに存在`)
}

export function printReport(report) {
  const icon = { ok: '  ok  ', info: ' info ', warn: ' WARN ', error: ' ERROR' }
  for (const r of report.results) {
    if (r.level === 'ok' && process.env.CHECK_QUIET) continue
    console.log(`${icon[r.level]} ${r.dataset}${r.edition ? `@${r.edition}` : ''}: ${r.message}`)
  }
  console.log(`\nエラー ${report.errors} 件 / 警告 ${report.warnings} 件`)
}
