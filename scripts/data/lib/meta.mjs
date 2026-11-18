import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { META_PATH, MANIFEST_PATH, PUBLIC_DIR } from './paths.mjs'

// src/assets/meta.json is generated and is the repo's record of what it
// holds ("B"): one entry per dataset, each edition with its generated
// file(s), provenance, the `ref` needed to fetch it again, and `enabled` —
// whether the app offers/uses it ("C"). The app only ever sees enabled
// editions. A CSV edition also lists its `columns` (the header after
// `code`), read from the file itself on every write — so the app knows which
// variables an edition provides before fetching it (src/data/schema.ts).

export const readManifest = () => JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

export function readMeta() {
  if (!existsSync(META_PATH)) return { datasets: {} }
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  return meta.datasets ? meta : { datasets: {} }
}

const ATTRIBUTION_KEYS = ['label', 'name', 'agency', 'page', 'license']
const indexOr = (arr, v) => { const i = arr.indexOf(v); return i === -1 ? Infinity : i }
// Same date: the plain edition before its variants ("2025" before "2025-sokuho").
const byNewest = (a, b) => (b.as_of ?? '').localeCompare(a.as_of ?? '') || a.id.length - b.id.length || b.id.localeCompare(a.id)

/** A generated CSV's columns after `code`, or undefined for other files. */
function csvColumns(path) {
  const file = resolve(PUBLIC_DIR, path ?? '')
  if (!path?.endsWith('.csv') || !existsSync(file)) return undefined
  const header = readFileSync(file, 'utf-8').split('\n', 1)[0].trim()
  const [first, ...rest] = header.split(',')
  if (first !== 'code') throw new Error(`${path}: 1列目が code ではありません`)
  return rest
}
const withColumns = (e) => {
  const columns = csvColumns(e.path)
  return columns ? { ...e, columns } : e
}

function writeMeta(meta) {
  const manifest = readManifest()
  const order = Object.keys(manifest)
  const datasets = {}
  for (const id of Object.keys(meta.datasets).sort((a, b) => indexOr(order, a) - indexOr(order, b))) {
    const src = manifest[id] ?? {}
    const attribution = Object.fromEntries(ATTRIBUTION_KEYS.filter(k => src[k] !== undefined).map(k => [k, src[k]]))
    const { extras } = meta.datasets[id]
    datasets[id] = { ...attribution, ...(extras ? { extras } : {}), editions: meta.datasets[id].editions.map(withColumns).sort(byNewest) }
  }
  writeFileSync(META_PATH, JSON.stringify({ datasets }, null, 2) + '\n')
}

/** Rewrites meta.json as is (refreshing each edition's `columns`). */
export const refreshMeta = () => writeMeta(readMeta())

/**
 * Adds or replaces editions (matched by id). A rebuilt edition keeps its
 * `enabled` flag; a newly added one is enabled unless `enabled: false` is
 * passed. For single-edition datasets every other edition is dropped.
 */
export function upsertEditions(id, editions, { single = false } = {}) {
  const meta = readMeta()
  const prev = meta.datasets[id]?.editions ?? []
  const prevById = new Map(prev.map(e => [e.id, e]))
  const incoming = editions.map(e => ({ ...e, enabled: e.enabled ?? prevById.get(e.id)?.enabled ?? true }))
  const ids = new Set(incoming.map(e => e.id))
  meta.datasets[id] = { editions: single ? incoming : [...incoming, ...prev.filter(e => !ids.has(e.id))] }
  writeMeta(meta)
}

/** Removes editions from meta.json and returns the removed entries. */
export function removeEditions(id, editionIds) {
  const meta = readMeta()
  const ds = meta.datasets[id]
  if (!ds) return []
  const removed = ds.editions.filter(e => editionIds.includes(e.id))
  ds.editions = ds.editions.filter(e => !editionIds.includes(e.id))
  writeMeta(meta)
  return removed
}

/**
 * Dataset-level derived files (not editions), e.g. jumin's population
 * series across all held editions: { series: 'data/jumin/series.csv' }.
 */
export function setExtras(id, extras) {
  const meta = readMeta()
  if (!meta.datasets[id]) return
  if (extras && Object.keys(extras).length) meta.datasets[id].extras = extras
  else delete meta.datasets[id].extras
  writeMeta(meta)
}

export function setEnabled(id, editionIds, enabled) {
  const meta = readMeta()
  const ds = meta.datasets[id]
  if (!ds) throw new Error(`${id} はまだありません`)
  const missing = editionIds.filter(eid => !ds.editions.some(e => e.id === eid))
  if (missing.length) throw new Error(`${id} に存在しない版: ${missing.join(', ')}`)
  for (const e of ds.editions) if (editionIds.includes(e.id)) e.enabled = enabled
  writeMeta(meta)
}
