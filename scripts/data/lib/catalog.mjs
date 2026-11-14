// The catalog = what each publisher offers right now ("A"), as found by the
// last `discover`. It's a snapshot of the outside world, not repo data, so it
// lives in the cache and is rebuilt with one command / button.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CACHE_DIR } from './paths.mjs'

const CATALOG_PATH = resolve(CACHE_DIR, 'catalog.json')

export function readCatalog() {
  if (!existsSync(CATALOG_PATH)) return { datasets: {} }
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'))
}

/** Replaces one dataset's entry: { checked_at, editions: [{id, as_of, label, ref}], error? }. */
export function writeCatalogDataset(id, entry) {
  const catalog = readCatalog()
  catalog.datasets[id] = { checked_at: new Date().toISOString(), ...entry }
  catalog.checked_at = catalog.datasets[id].checked_at
  mkdirSync(dirname(CATALOG_PATH), { recursive: true })
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n')
}
