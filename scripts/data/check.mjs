// Consistency checks over the generated data (what meta.json points at).
// Errors = the data is broken (bad codes, missing files, totals that don't
// add up). Warnings = worth a look (coverage dropped, big jumps between
// editions, a newer edition is probably out). Used by `npm run data -- check`
// and the management UI.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseCsv } from './lib/csv.mjs'
import { readMeta, readManifest } from './lib/meta.mjs'
import { ASSETS_DIR, PUBLIC_DIR, CHECK_REPORT_PATH } from './lib/paths.mjs'

const readCsvRows = (path) => {
  const [header, ...rows] = parseCsv(readFileSync(path, 'utf-8')).filter(r => r.length > 1 || r[0] !== '')
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])))
}
const num = (v) => (v === '' || v === undefined ? null : Number(v))

// Datasets keyed by municipality, and the column that should be filled for
// (nearly) every official municipality.
const MUNICIPAL = { jumin: 'totalpop', kokusei: 'totalpop', area: 'area', rent: 'inc0_total' }
// Max relative change between consecutive editions before warning.
const JUMP = { jumin: 0.2, kokusei: 0.2, area: 0.05 }
// Expected publication rhythm: how old the latest edition can get (days)
// before a newer one has probably been published.
const STALE_AFTER_DAYS = { area: 200, jumin: 600, minwage: 400, codes: null, dantai: null, kokusei: null, rent: 365 * 6, designations: 365 * 2, map: 550 }

export async function runChecks() {
  const meta = readMeta()
  const manifest = readManifest()
  const results = []
  const add = (level, dataset, edition, message) => results.push({ level, dataset, edition, message })

  const officialPath = resolve(ASSETS_DIR, 'dantai_codes.json')
  const official = existsSync(officialPath) ? new Set(JSON.parse(readFileSync(officialPath, 'utf-8'))) : new Set()
  if (official.size === 0) add('error', 'dantai', null, 'dantai_codes.json がありません')

  for (const [id, src] of Object.entries(manifest)) {
    const ds = meta.datasets[id]
    if (!ds || !ds.editions?.length) { add('warn', id, null, '未ビルド（meta.json に版がありません）'); continue }

    // Staleness.
    const latest = ds.editions[0]
    const limit = STALE_AFTER_DAYS[id]
    const ref = id === 'designations' ? latest.checked_at : latest.as_of
    if (limit && ref) {
      const age = (Date.now() - Date.parse(ref)) / 86400e3
      if (age > limit) add('warn', id, latest.id, `最新版が ${Math.round(age)} 日前（${ref}）。新しい版が公表されていないか確認してください（${src.page}）`)
    }
    for (const e of ds.editions) if (e.source?.manual && id !== 'designations') add('warn', id, e.id, '手作業で作られた版です（パイプラインで再生成されていません）')
    if (src.editions && Array.isArray(src.editions)) {
      const pending = src.editions.filter(e => 'main' in e && (!e.main || !e.age))
      for (const e of pending) add('warn', id, String(e.year), 'statInfId 未設定のため取得されていません')
    }

    const prevByCode = { map: null }
    // Editions are newest first; walk oldest → newest to compare with the previous one.
    for (const e of [...ds.editions].reverse()) {
      const files = [e.path, e.adjacency].filter(Boolean)
      for (const f of files) if (!existsSync(resolve(PUBLIC_DIR, f))) add('error', id, e.id, `ファイルがありません: public/${f}`)
      if (!e.path || !e.path.endsWith('.csv') || !existsSync(resolve(PUBLIC_DIR, e.path))) {
        if (id === 'map' && e.path && existsSync(resolve(PUBLIC_DIR, e.path))) checkMap(e, meta, add)
        continue
      }
      const rows = readCsvRows(resolve(PUBLIC_DIR, e.path))

      // Schema: 5-digit codes, unique.
      const bad = rows.filter(r => !/^\d{5}$/.test(r.code ?? ''))
      if (bad.length) add('error', id, e.id, `5桁でないコード ${bad.length} 件（例: ${bad.slice(0, 3).map(r => r.code).join(', ')}）`)
      const seen = new Set(), dup = new Set()
      for (const r of rows) (seen.has(r.code) ? dup : seen).add(r.code)
      if (dup.size) add('error', id, e.id, `重複コード ${dup.size} 件（例: ${[...dup].slice(0, 3).join(', ')}）`)

      const col = MUNICIPAL[id]
      if (!col) continue
      const byCode = new Map(rows.map(r => [r.code, r]))

      // Coverage of official municipalities.
      const covered = [...official].filter(c => num(byCode.get(c)?.[col]) !== null).length
      const pct = official.size ? covered / official.size : 0
      const msg = `公共団体 ${official.size} 件中 ${covered} 件に値あり（${(pct * 100).toFixed(1)}%）`
      if (id !== 'rent' && pct < 0.99) add('warn', id, e.id, msg)
      else add('ok', id, e.id, msg)

      // Totals add up: prefectures → national, municipalities → prefecture.
      if (col === 'totalpop') checkTotals(id, e, byCode, official, col, add, 0)
      if (col === 'area') checkTotals(id, e, byCode, official, col, add, 0.005)

      // Big jumps vs the previous edition.
      const prev = prevByCode[id]
      if (prev && JUMP[id]) {
        const jumps = []
        for (const c of official) {
          const a = num(prev.get(c)?.[col]), b = num(byCode.get(c)?.[col])
          if (a && b && Math.abs(b - a) / a > JUMP[id]) jumps.push(`${c}: ${a}→${b}`)
        }
        if (jumps.length) add('warn', id, e.id, `前の版から ±${JUMP[id] * 100}% 超の変化 ${jumps.length} 件（${jumps.slice(0, 4).join(', ')}${jumps.length > 4 ? ' …' : ''}）`)
      }
      prevByCode[id] = byCode
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    errors: results.filter(r => r.level === 'error').length,
    warnings: results.filter(r => r.level === 'warn').length,
    results,
  }
  mkdirSync(dirname(CHECK_REPORT_PATH), { recursive: true })
  writeFileSync(CHECK_REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
  return report
}

function checkTotals(id, e, byCode, official, col, add, tolerance) {
  const close = (a, b) => Math.abs(a - b) <= Math.max(tolerance * Math.abs(b), tolerance ? 0.5 : 0)
  const national = num(byCode.get('00000')?.[col])
  const prefs = [...byCode.keys()].filter(c => /^\d\d000$/.test(c) && c !== '00000')
  const problems = []
  if (national !== null) {
    const sum = prefs.reduce((s, c) => s + (num(byCode.get(c)[col]) ?? 0), 0)
    if (!close(sum, national)) problems.push(`都道府県の合計 ${round(sum)} ≠ 全国 ${national}`)
  }
  for (const p of prefs) {
    const pv = num(byCode.get(p)[col])
    if (pv === null) continue
    const munis = [...official].filter(c => c.startsWith(p.slice(0, 2)))
    const sum = munis.reduce((s, c) => s + (num(byCode.get(c)?.[col]) ?? 0), 0)
    if (!close(sum, pv)) problems.push(`${p}: 市区町村の合計 ${round(sum)} ≠ ${pv}`)
  }
  if (problems.length) add(tolerance ? 'warn' : 'error', id, e.id, `合計が合いません: ${problems.slice(0, 4).join(' / ')}${problems.length > 4 ? ` …他${problems.length - 4}件` : ''}`)
  else add('ok', id, e.id, '合計の検算 OK（市区町村→都道府県→全国）')
}

function checkMap(e, meta, add) {
  const topo = JSON.parse(readFileSync(resolve(PUBLIC_DIR, e.path), 'utf-8'))
  const geoms = Object.values(topo.objects)[0].geometries
  const mapCodes = new Set(geoms.filter(g => g.type).map(g => g.properties.code))
  const codesEd = meta.datasets.codes?.editions?.[0]
  if (!codesEd) return
  const known = new Set(readCsvRows(resolve(PUBLIC_DIR, codesEd.path)).map(r => r.code))
  const unknown = [...mapCodes].filter(c => !known.has(c))
  if (unknown.length) add('warn', 'map', e.id, `標準地域コードにないコードの図形 ${unknown.length} 件（${unknown.slice(0, 5).join(', ')}）`)
  else add('ok', 'map', e.id, `図形 ${mapCodes.size} コード、すべて標準地域コードに存在`)
}

const round = (n) => Math.round(n * 100) / 100

export function printReport(report) {
  const icon = { ok: '  ok  ', warn: ' WARN ', error: ' ERROR' }
  for (const r of report.results) {
    if (r.level === 'ok' && process.env.CHECK_QUIET) continue
    console.log(`${icon[r.level]} ${r.dataset}${r.edition ? `@${r.edition}` : ''}: ${r.message}`)
  }
  console.log(`\nエラー ${report.errors} 件 / 警告 ${report.warnings} 件`)
}
