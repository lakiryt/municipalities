// 指定都市・中核市・施行時特例市: hand-maintained in data/curated (the sources
// are an HTML page and PDFs, and the lists change once every few years).
// The build validates codes/names against the 標準地域コード and writes a
// normalized `code,type,since` CSV.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { writeCsv } from '../lib/csv.mjs'
import { parseCsv } from '../lib/csv.mjs'
import { CURATED_DIR, PUBLIC_DIR } from '../lib/paths.mjs'
import { readMeta } from '../lib/meta.mjs'

export async function fetchRaw(_src, opts) {
  opts.log('  skip    手管理データ（data/curated/designations.json）のため取得なし')
}

const TYPES = ['seirei', 'chukaku', 'tokurei']

export async function build(src) {
  const curated = JSON.parse(readFileSync(resolve(CURATED_DIR, src.curated), 'utf-8'))

  // Every code must exist in the latest 標準地域コード with the same name —
  // catches typos and stale entries after a merger.
  const codesEdition = readMeta().datasets.codes?.editions?.[0]
  if (!codesEdition) throw new Error('designations: build `codes` first')
  const [header, ...codeRows] = parseCsv(readFileSync(resolve(PUBLIC_DIR, codesEdition.path), 'utf-8'))
  const nameOf = new Map(codeRows.map(r => [r[header.indexOf('code')], r[header.indexOf('name')]]))

  const rows = []
  for (const type of TYPES) {
    for (const e of curated[type] ?? []) {
      const actual = nameOf.get(e.code)
      if (actual === undefined) throw new Error(`designations.json: ${type} ${e.code} (${e.name}) は標準地域コードに存在しません`)
      if (actual !== e.name) throw new Error(`designations.json: ${e.code} の名前が一致しません（${e.name} ≠ ${actual}）`)
      rows.push({ code: e.code, type, since: e.since ?? '' })
    }
  }
  rows.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.code.localeCompare(b.code))
  const out = writeCsv(resolve(PUBLIC_DIR, `data/designations/${curated.as_of}.csv`), ['code', 'type', 'since'], rows)
  return {
    editions: [{
      id: curated.as_of, as_of: curated.as_of, checked_at: curated.checked_at,
      path: out.file.replace(/^public\//, ''), rows: out.rows,
      counts: Object.fromEntries(TYPES.map(t => [t, (curated[t] ?? []).length])),
      source: { url: null, manual: true },
    }],
  }
}
