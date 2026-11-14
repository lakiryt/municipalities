// Edition-level operations shared by the CLI and the management UI:
//   A (catalog: what the publisher offers) → discover
//   B (repo: what's generated)            → get / rebuild / remove
//   C (app: what's offered/used)          → enable / disable (meta.mjs)
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { DATASETS } from '../datasets/index.mjs'
import { readCatalog, writeCatalogDataset } from './catalog.mjs'
import { readMeta, upsertEditions, removeEditions } from './meta.mjs'
import { PUBLIC_DIR, ROOT } from './paths.mjs'

export async function discoverDataset(id, src, opts) {
  try {
    const editions = await DATASETS[id].discover(src, opts)
    writeCatalogDataset(id, { editions })
    return editions
  } catch (e) {
    // Keep the last known list, but record that this check failed.
    writeCatalogDataset(id, { editions: readCatalog().datasets[id]?.editions ?? [], error: e.message })
    throw e
  }
}

const heldEditions = (id) => readMeta().datasets[id]?.editions ?? []

/** Files an edition generated: public/… paths plus repo-relative bundled files. */
export const editionFiles = (e) => [
  ...[e.path, e.adjacency].filter(Boolean).map(f => resolve(PUBLIC_DIR, f)),
  ...Object.values(e.files ?? {}).map(f => resolve(ROOT, f)),
]

/**
 * Downloads (if not cached, or always with opts.force) and builds the given
 * editions. The ref comes from the catalog for new editions, or from
 * meta.json for ones already held (so rebuilding works without a fresh
 * discover). New editions are enabled unless opts.enable === false.
 */
export async function getEditions(id, src, editionIds, opts) {
  const catalog = readCatalog().datasets[id]?.editions ?? []
  if (src.single && editionIds.length > 1) throw new Error(`${id} は1版のみ保持するデータです`)
  for (const eid of editionIds) {
    const held = heldEditions(id)
    const ref = catalog.find(e => e.id === eid)?.ref ?? held.find(e => e.id === eid)?.ref
    if (!ref) throw new Error(`${id}: 版 ${eid} が見つかりません（先に「配布元を確認」してください）`)
    opts.log(`  ${id}@${eid}`)
    await DATASETS[id].fetchEdition(src, ref, opts)
    const built = await DATASETS[id].buildEdition(src, ref, opts)
    const isNew = !held.some(e => e.id === built.id)
    if (src.single) {
      // Replacing the only edition: drop files the old one wrote elsewhere.
      const keep = new Set(editionFiles(built))
      for (const old of held.filter(e => e.id !== built.id)) {
        for (const f of editionFiles(old)) if (!keep.has(f) && existsSync(f)) rmSync(f)
      }
    }
    upsertEditions(id, [{ ...built, ref, ...(isNew && opts.enable === false ? { enabled: false } : {}) }], { single: src.single })
  }
}

/** Rebuilds every held edition (or the given ones) from its stored ref. */
export async function rebuildHeld(id, src, opts, editionIds = null) {
  const ids = editionIds ?? heldEditions(id).map(e => e.id)
  await getEditions(id, src, ids, opts)
  return ids
}

/** Deletes editions' generated files and their meta.json entries (the raw cache is kept). */
export function removeHeld(id, src, editionIds) {
  if (src.single) throw new Error(`${id} は1版のみ保持するデータのため削除できません（別の版を取得すると置き換わります）`)
  const removed = removeEditions(id, editionIds)
  for (const e of removed) for (const f of editionFiles(e)) if (existsSync(f)) rmSync(f)
  return removed.map(e => e.id)
}

/** Catalog editions not held, optionally only those newer than the newest held. */
export function missingEditions(id, { newerOnly = false } = {}) {
  const held = heldEditions(id)
  const heldIds = new Set(held.map(e => e.id))
  const newest = held.map(e => e.as_of).sort().at(-1) ?? ''
  return (readCatalog().datasets[id]?.editions ?? [])
    .filter(e => !heldIds.has(e.id) && e.available !== false)
    .filter(e => !newerOnly || (e.as_of ?? '') > newest)
}
