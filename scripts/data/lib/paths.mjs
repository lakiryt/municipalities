import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Raw downloads, exactly as served. Not committed (see .gitignore).
export const CACHE_DIR = resolve(ROOT, 'data/.cache')
// Hand-maintained inputs that are never fetched (committed).
export const CURATED_DIR = resolve(ROOT, 'data/curated')
// Where the app fetches generated data from at runtime (committed).
export const PUBLIC_DIR = resolve(ROOT, 'public')
// Generated data the app bundles at build time (committed).
export const ASSETS_DIR = resolve(ROOT, 'src/assets')

export const MANIFEST_PATH = resolve(ROOT, 'data/sources.json')
export const META_PATH = resolve(ASSETS_DIR, 'meta.json')
export const FETCH_LOG_PATH = resolve(CACHE_DIR, 'fetch-log.json')
export const CHECK_REPORT_PATH = resolve(CACHE_DIR, 'check-report.json')

/** Repo-relative path with forward slashes, for logs and meta.json. */
export const rel = (abs) => relative(ROOT, abs).split(sep).join('/')
