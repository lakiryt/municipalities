import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { META_PATH, MANIFEST_PATH } from './paths.mjs'

// src/assets/meta.json is generated: one entry per dataset, each with the
// attribution fields from data/sources.json plus the editions the build step
// actually produced. Building one dataset rewrites only that dataset's entry,
// so datasets can be refreshed independently.

export const readManifest = () => JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

export function readMeta() {
  if (!existsSync(META_PATH)) return { datasets: {} }
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  return meta.datasets ? meta : { datasets: {} }
}

const ATTRIBUTION_KEYS = ['label', 'name', 'agency', 'page', 'license']

/**
 * Replaces one dataset's entry. `editions` are sorted newest first so the
 * app's default (editions[0]) is the latest.
 */
export function updateMetaDataset(id, manifestEntry, editions, extra = {}) {
  const meta = readMeta()
  const attribution = Object.fromEntries(
    ATTRIBUTION_KEYS.filter(k => manifestEntry[k] !== undefined).map(k => [k, manifestEntry[k]])
  )
  const sorted = [...editions].sort((a, b) => (b.as_of ?? '').localeCompare(a.as_of ?? '') || a.id.localeCompare(b.id))
  meta.datasets[id] = { ...attribution, ...extra, editions: sorted }

  // Keep datasets in manifest order so diffs stay stable.
  const order = Object.keys(readManifest())
  const datasets = Object.fromEntries(
    Object.entries(meta.datasets).sort(([a], [b]) => indexOr(order, a) - indexOr(order, b))
  )
  writeFileSync(META_PATH, JSON.stringify({ datasets }, null, 2) + '\n')
}

const indexOr = (arr, v) => { const i = arr.indexOf(v); return i === -1 ? Infinity : i }
