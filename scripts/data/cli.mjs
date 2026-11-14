#!/usr/bin/env node
// Data pipeline entry point. See DATA_PIPELINE.md.
//
//   npm run data -- discover [dataset...|all]        配布元の版を確認（A）
//   npm run data -- get <dataset> <版...>            版を取得して生成（B に追加）
//   npm run data -- get <dataset> --missing|--newer  未取得の版をすべて / 保持中より新しい版を取得
//   npm run data -- remove <dataset> <版...>         生成物を削除（B から外す）
//   npm run data -- enable|disable <dataset> <版...> アプリで使う版を切り替え（C）
//   npm run data -- update [dataset...|all] [--force] 保持中の版を作り直す（--force で取り直し）
//   npm run data -- check | status | ui [--port 5180]
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './lib/paths.mjs'
import { readManifest, readMeta, setEnabled } from './lib/meta.mjs'
import { readCatalog } from './lib/catalog.mjs'
import { discoverDataset, getEditions, rebuildHeld, removeHeld, missingEditions } from './lib/editions.mjs'
import { runChecks, printReport } from './check.mjs'

loadEnvLocal()

const VALUE_FLAGS = new Set(['port'])
const argv = process.argv.slice(2)
const command = argv[0]
const flags = {}
const positional = []
for (let i = 1; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=')
    // Only these take a value as the next argument; the rest are switches.
    flags[k] = v ?? (VALUE_FLAGS.has(k) && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
  } else positional.push(a)
}

const log = (...a) => console.log(...a)
const opts = { force: Boolean(flags.force), log, enable: !flags.disabled }

try {
  const manifest = readManifest()
  const one = () => {
    const id = positional[0]
    if (!manifest[id]) throw new Error(`データセットを指定してください: ${Object.keys(manifest).join(', ')}`)
    return [id, manifest[id]]
  }
  const many = (dflt) => {
    const names = positional.length ? positional : dflt
    const ids = names.includes('all') ? Object.keys(manifest) : names
    for (const id of ids) if (!manifest[id]) throw new Error(`不明なデータセット: ${id}`)
    return ids.map(id => [id, manifest[id]])
  }

  switch (command) {
    case 'discover': {
      let failed = 0
      for (const [id, src] of many(['all'])) {
        log(`\n[discover] ${id} — ${src.label}`)
        try {
          const eds = await discoverDataset(id, src, opts)
          const held = new Set((readMeta().datasets[id]?.editions ?? []).map(e => e.id))
          const missing = missingEditions(id)
          log(`  配布元 ${eds.length} 版（保持 ${eds.filter(e => held.has(e.id)).length}、未取得 ${missing.length}）${missing.length ? ': ' + missing.map(e => e.id).slice(0, 12).join(', ') + (missing.length > 12 ? ' …' : '') : ''}`)
        } catch (e) { failed++; log(`  失敗: ${e.message}`) }
      }
      if (failed) process.exitCode = 1
      break
    }
    case 'get': {
      const [id, src] = one()
      const ids = flags.missing ? missingEditions(id).map(e => e.id)
        : flags.newer ? missingEditions(id, { newerOnly: true }).map(e => e.id)
        : positional.slice(1)
      if (ids.length === 0) { log('取得する版はありません'); break }
      log(`\n[get] ${id}: ${ids.join(', ')}`)
      await getEditions(id, src, ids, opts)
      await reportChecks()
      break
    }
    case 'remove': {
      const [id, src] = one()
      const removed = await removeHeld(id, src, positional.slice(1), opts)
      log(`削除: ${id} ${removed.join(', ') || '（該当なし）'}`)
      break
    }
    case 'enable':
    case 'disable': {
      const [id] = one()
      setEnabled(id, positional.slice(1), command === 'enable')
      log(`${command === 'enable' ? '有効化' : '無効化'}: ${id} ${positional.slice(1).join(', ')}`)
      break
    }
    case 'update': {
      // `all` skips heavy datasets (the ~800MB map) — name them explicitly.
      const targets = many(['all']).filter(([id, src]) => positional.includes(id) || !src.heavy)
      for (const [id, src] of targets) {
        log(`\n[update] ${id} — ${src.label}`)
        const ids = await rebuildHeld(id, src, opts)
        log(`  ${ids.length} 版を生成: ${ids.join(', ')}`)
      }
      await reportChecks()
      break
    }
    case 'check': {
      const report = await runChecks()
      printReport(report)
      process.exitCode = report.errors > 0 ? 1 : 0
      break
    }
    case 'status': printStatus(manifest); break
    case 'ui': {
      const { startUi } = await import('./ui/server.mjs')
      await startUi({ port: Number(flags.port) || 5180 })
      break
    }
    default:
      console.log(readFileSync(new URL(import.meta.url), 'utf-8').split('\n').filter(l => l.startsWith('//')).slice(1, 11).map(l => l.slice(3)).join('\n'))
      process.exitCode = command ? 1 : 0
  }
} catch (e) {
  console.error(`\nエラー: ${e.message}`)
  if (flags.verbose) console.error(e.stack)
  process.exitCode = 1
}

async function reportChecks() {
  log('\n[check]')
  printReport(await runChecks())
}

function printStatus(manifest) {
  const meta = readMeta(), catalog = readCatalog()
  console.log(`配布元の確認: ${catalog.checked_at ? new Date(catalog.checked_at).toLocaleString('ja-JP') : '未確認'}\n`)
  for (const [id, src] of Object.entries(manifest)) {
    const held = meta.datasets[id]?.editions ?? []
    const cat = catalog.datasets[id]?.editions
    const newestA = cat?.map(e => e.as_of).sort().at(-1) ?? '?'
    const newestB = held.map(e => e.as_of).sort().at(-1) ?? '-'
    console.log(`${id.padEnd(13)} 配布元 ${String(cat?.length ?? '?').padStart(3)}  保持 ${String(held.length).padStart(3)}  有効 ${String(held.filter(e => e.enabled !== false).length).padStart(3)}  最新 配布元 ${newestA} / 保持 ${newestB}  ${src.label}`)
  }
}

function loadEnvLocal() {
  const path = resolve(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
