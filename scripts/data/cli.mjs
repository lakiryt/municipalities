#!/usr/bin/env node
// Data pipeline entry point. See DATA_PIPELINE.md.
//
//   npm run data -- fetch  <dataset...|all> [--force] [--years 2020-2025]
//   npm run data -- build  <dataset...|all> [--years ...]
//   npm run data -- update <dataset...|all> [--force] [--years ...]   (fetch + build)
//   npm run data -- check
//   npm run data -- status
//   npm run data -- find jumin --year 2022
//   npm run data -- ui [--port 5180]
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './lib/paths.mjs'
import { readManifest, readMeta, updateMetaDataset } from './lib/meta.mjs'
import { DATASETS } from './datasets/index.mjs'
import { runChecks, printReport } from './check.mjs'

loadEnvLocal()

const argv = process.argv.slice(2)
const command = argv[0]
const flags = {}
const positional = []
for (let i = 1; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=')
    flags[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
  } else positional.push(a)
}

const log = (...a) => console.log(...a)
const opts = { force: Boolean(flags.force), log, years: parseYears(flags.years) }

try {
  switch (command) {
    case 'fetch':  await forEachDataset(positional, 'fetch'); break
    case 'build':  await forEachDataset(positional, 'build'); await reportChecks(); break
    case 'update': await forEachDataset(positional, 'fetch'); await forEachDataset(positional, 'build'); await reportChecks(); break
    case 'check': {
      const report = await runChecks()
      printReport(report)
      process.exitCode = report.errors > 0 ? 1 : 0
      break
    }
    case 'status': printStatus(); break
    case 'find': await find(positional[0]); break
    case 'ui': {
      const { startUi } = await import('./ui/server.mjs')
      await startUi({ port: Number(flags.port) || 5180 })
      break
    }
    default:
      console.log(readFileSync(new URL(import.meta.url), 'utf-8').split('\n').filter(l => l.startsWith('//')).slice(0, 10).map(l => l.slice(3)).join('\n'))
      process.exitCode = command ? 1 : 0
  }
} catch (e) {
  console.error(`\nエラー: ${e.message}`)
  if (flags.verbose) console.error(e.stack)
  process.exitCode = 1
}

function resolveDatasets(names) {
  const manifest = readManifest()
  const all = Object.keys(manifest)
  if (names.length === 0) throw new Error(`データセットを指定してください: ${all.join(', ')} または all`)
  // `all` skips heavy datasets (the ~800MB map) — name them explicitly.
  const picked = names.includes('all') ? all.filter(id => !manifest[id].heavy) : names
  for (const id of picked) {
    if (!manifest[id]) throw new Error(`不明なデータセット: ${id}（${all.join(', ')}）`)
    if (!DATASETS[id]) throw new Error(`${id} の実装がありません（scripts/data/datasets/）`)
  }
  // Always run in manifest order: later datasets read earlier outputs
  // (minwage needs prefectures from dantai, designations needs codes).
  return all.filter(id => picked.includes(id)).map(id => [id, manifest[id]])
}

async function forEachDataset(names, step) {
  for (const [id, src] of resolveDatasets(names)) {
    log(`\n[${step}] ${id} — ${src.label}`)
    const mod = DATASETS[id]
    if (step === 'fetch') {
      await mod.fetchRaw(src, opts)
    } else {
      const result = await mod.build(src, opts)
      let editions = result.editions
      if (result.merge) {
        // Datasets built per-year: keep editions this run didn't touch.
        const prev = readMeta().datasets[id]?.editions ?? []
        const rebuilt = new Set(editions.map(e => e.id))
        editions = [...editions, ...prev.filter(e => !rebuilt.has(e.id))]
      }
      updateMetaDataset(id, src, editions)
      log(`  built   ${editions.length} edition(s): ${editions.map(e => e.id).join(', ')}`)
    }
  }
}

async function reportChecks() {
  log('\n[check]')
  const report = await runChecks()
  printReport(report)
}

function printStatus() {
  const meta = readMeta()
  for (const [id, src] of Object.entries(readManifest())) {
    const ds = meta.datasets[id]
    const eds = ds?.editions ?? []
    const latest = eds[0]
    const manual = eds.filter(e => e.source?.manual).length
    console.log(`${id.padEnd(13)} ${String(eds.length).padStart(3)} 版  最新 ${latest?.as_of ?? '-'}  取得 ${latest?.source?.retrieved_at ?? (manual ? '手作業' : '-')}  ${src.label}`)
  }
}

async function find(id) {
  const mod = DATASETS[id]
  if (!mod?.find) throw new Error(`find は ${Object.entries(DATASETS).filter(([, m]) => m.find).map(([k]) => k).join(', ')} のみ対応`)
  const r = await mod.find(readManifest()[id], { year: Number(flags.year) })
  console.log(JSON.stringify({ year: r.year, main: r.main, age: r.age }, null, 2))
  if (!r.main || !r.age) {
    console.log('\n見つからなかった表があります。この年の表一覧:')
    for (const x of r.all) console.log(`  ${x.id}  ${x.title}`)
  } else {
    console.log(`\ndata/sources.json の jumin.editions に追加: { "year": ${r.year}, "main": "${r.main}", "age": "${r.age}" }`)
  }
}

function parseYears(v) {
  if (!v || v === true) return null
  const out = []
  for (const part of String(v).split(',')) {
    const [a, b] = part.split('-').map(Number)
    for (let y = a; y <= (b || a); y++) out.push(y)
  }
  return out
}

function loadEnvLocal() {
  const path = resolve(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
