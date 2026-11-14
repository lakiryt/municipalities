import { constants, createHash } from 'node:crypto'
import https from 'node:https'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { CACHE_DIR, FETCH_LOG_PATH } from './paths.mjs'

const USER_AGENT = 'municipalities-data-pipeline'
// Government servers: be polite. One request per host per this many ms.
const MIN_INTERVAL_MS = 1000
// Files above this are streamed to disk and not returned as a Buffer.
const MAX_RETURN_BYTES = 200 * 1024 * 1024
const lastHit = new Map()

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const readLog = () => existsSync(FETCH_LOG_PATH) ? JSON.parse(readFileSync(FETCH_LOG_PATH, 'utf-8')) : {}
const writeLog = (log) => {
  mkdirSync(dirname(FETCH_LOG_PATH), { recursive: true })
  writeFileSync(FETCH_LOG_PATH, JSON.stringify(log, null, 2) + '\n')
}

/** The fetch-log entry for a cached file, or undefined if it was never fetched. */
export const fetchRecord = (cacheKey) => readLog()[cacheKey]

export const cachePath = (cacheKey) => resolve(CACHE_DIR, cacheKey)

const throttle = async (url) => {
  const host = new URL(url).host
  const wait = (lastHit.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastHit.set(host, Date.now())
}

// gsi.go.jp still requires TLS legacy renegotiation, which OpenSSL 3 (and so
// Node's fetch) refuses by default. Only on that specific failure, retry the
// one request through node:https with the legacy option enabled.
const LEGACY_ERR = 'ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED'

/** Opens a GET and returns { stream, contentType, size }. `label` is used in errors instead of the URL. */
async function httpGet(url, label) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${label}`)
    return { stream: Readable.fromWeb(res.body), contentType: res.headers.get('content-type'), size: Number(res.headers.get('content-length')) || null }
  } catch (e) {
    if (e?.cause?.code !== LEGACY_ERR) throw e
    return legacyGet(url, label)
  }
}

function legacyGet(url, label, redirects = 5) {
  return new Promise((resolvePromise, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume()
        resolvePromise(legacyGet(new URL(res.headers.location, url).href, label, redirects - 1))
        return
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode} for ${label}`)); return }
      resolvePromise({ stream: res, contentType: res.headers['content-type'] ?? null, size: Number(res.headers['content-length']) || null })
    })
    req.on('error', reject)
  })
}

/**
 * Downloads `url` into the cache under `cacheKey` (a relative path like
 * "area/R8_07_mencho.csv") unless it's already there. Streams to disk (so
 * the ~800MB N03 zip never sits in memory) and returns the bytes for files
 * under MAX_RETURN_BYTES, null otherwise.
 *
 * Every download is recorded in fetch-log.json (url, time, sha256) so the
 * build step can stamp provenance into meta.json. `logUrl` replaces the URL
 * in logs, errors and the record — used to keep API keys out of them.
 */
export async function download(url, cacheKey, { force = false, log = console.log, logUrl = url } = {}) {
  const path = cachePath(cacheKey)
  const body = () => statSync(path).size <= MAX_RETURN_BYTES ? readFileSync(path) : null
  if (!force && existsSync(path)) {
    log(`  cached  ${cacheKey}`)
    return body()
  }
  await throttle(url)
  log(`  GET     ${logUrl}`)
  const res = await httpGet(url, logUrl)
  mkdirSync(dirname(path), { recursive: true })

  const hash = createHash('sha256')
  let bytes = 0, lastReport = 0
  const tap = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk)
      bytes += chunk.length
      if (res.size && res.size > 20e6 && bytes - lastReport > 50e6) {
        lastReport = bytes
        log(`          ${(bytes / 1e6).toFixed(0)} / ${(res.size / 1e6).toFixed(0)} MB`)
      }
      cb(null, chunk)
    },
  })
  const tmp = `${path}.part`
  await pipeline(res.stream, tap, createWriteStream(tmp))
  renameSync(tmp, path)

  const entries = readLog()
  const prev = entries[cacheKey]
  const digest = hash.digest('hex')
  if (prev && prev.sha256 !== digest) log(`  changed ${cacheKey} (content differs from the previous fetch)`)
  entries[cacheKey] = {
    url: logUrl,
    retrieved_at: new Date().toISOString(),
    sha256: digest,
    bytes,
    content_type: res.contentType,
  }
  writeLog(entries)
  log(`  saved   ${cacheKey} (${bytes > 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB'})`)
  return body()
}

/**
 * Fetches a page for discovery (not cached — the point is to see what the
 * publisher has right now). Returns the bytes; decode with decodeText().
 */
export async function getPage(url, { log = () => {}, logUrl = url } = {}) {
  await throttle(url)
  log(`  GET     ${logUrl}`)
  const res = await httpGet(url, logUrl)
  const chunks = []
  for await (const c of res.stream) chunks.push(c)
  return Buffer.concat(chunks)
}

/** Reads a previously downloaded file, with a helpful error if `fetch` hasn't run. */
export function readCached(cacheKey) {
  const path = cachePath(cacheKey)
  if (!existsSync(path)) throw new Error(`Not in cache: ${cacheKey} — run \`npm run data -- fetch\` for this dataset first`)
  return readFileSync(path)
}

/** Provenance block for meta.json: where the raw file came from and what it was. */
export function provenance(cacheKey) {
  const r = fetchRecord(cacheKey)
  if (!r) return undefined
  return { url: r.url, retrieved_at: r.retrieved_at.slice(0, 10), sha256: r.sha256 }
}
