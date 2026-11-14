// 指定都市・中核市・施行時特例市: hand-maintained in data/curated (the sources
// are an HTML page and PDFs, and the lists change once every few years).
// The build validates codes/names against the 標準地域コード and writes a
// normalized `code,type,since` CSV. The repo holds one edition (`single`).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { writeDataCsv, parseCsv } from '../lib/csv.mjs'
import { CURATED_DIR, PUBLIC_DIR } from '../lib/paths.mjs'
import { readMeta } from '../lib/meta.mjs'

const TYPES = ['seirei', 'chukaku', 'tokurei']
const readCurated = (src) => JSON.parse(readFileSync(resolve(CURATED_DIR, src.curated), 'utf-8'))

export async function discover(src) {
  const c = readCurated(src)
  return [{ id: c.as_of, as_of: c.as_of, label: c.as_of, ref: { as_of: c.as_of }, available: true }]
}

export async function fetchEdition() {}

export async function buildEdition(src) {
  const curated = readCurated(src)

  // Every code must exist in the latest 標準地域コード with the same name —
  // catches typos and stale entries after a merger.
  const codesEdition = readMeta().datasets.codes?.editions?.find(e => e.enabled !== false)
  if (!codesEdition) throw new Error('designations: 標準地域コード（codes）を先に用意してください')
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
  const out = writeDataCsv('designations', curated.as_of, ['code', 'type', 'since'], rows)
  return {
    id: curated.as_of, as_of: curated.as_of, checked_at: curated.checked_at,
    ...out,
    counts: Object.fromEntries(TYPES.map(t => [t, (curated[t] ?? []).length])),
    source: { url: null, manual: true },
  }
}
