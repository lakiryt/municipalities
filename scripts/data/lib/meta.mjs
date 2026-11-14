import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { META_PATH, MANIFEST_PATH } from './paths.mjs'

// src/assets/meta.json is generated and is the repo's record of what it
// holds ("B"): one entry per dataset, each edition with its generated
// file(s), provenance, the `ref` needed to fetch it again, and `enabled` —
// whether the app offers/uses it ("C"). The app only ever sees enabled
// editions.

export const readManifest = () => JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

export function readMeta() {
  if (!existsSync(META_PATH)) return { datasets: {} }
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  return meta.datasets ? meta : { datasets: {} }
}

const ATTRIBUTION_KEYS = ['label', 'name', 'agency', 'page', 'license']
const indexOr = (arr, v) => { const i = arr.indexOf(v); return i === -1 ? Infinity : i }
const byNewest = (a, b) => (b.as_of ?? '').localeCompare(a.as_of ?? '') || b.id.localeCompare(a.id)

function writeMeta(meta) {
  const manifest = readManifest()
  const order = Object.keys(manifest)
  const datasets = {}
  for (const id of Object.keys(meta.datasets).sort((a, b) => indexOr(order, a) - indexOr(order, b))) {
    const src = manifest[id] ?? {}
    const attribution = Object.fromEntries(ATTRIBUTION_KEYS.filter(k => src[k] !== undefined).map(k => [k, src[k]]))
    datasets[id] = { ...attribution, editions: [...meta.datasets[id].editions].sort(byNewest) }
  }
  writeFileSync(META_PATH, JSON.stringify({ datasets }, null, 2) + '\n')
}

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

export function setEnabled(id, editionIds, enabled) {
  const meta = readMeta()
  const ds = meta.datasets[id]
  if (!ds) throw new Error(`${id} はまだありません`)
  const missing = editionIds.filter(eid => !ds.editions.some(e => e.id === eid))
  if (missing.length) throw new Error(`${id} に存在しない版: ${missing.join(', ')}`)
  for (const e of ds.editions) if (editionIds.includes(e.id)) e.enabled = enabled
  writeMeta(meta)
}
