// Local management UI for the data pipeline: `npm run data -- ui`.
// Shows, per dataset, what the publisher offers (A, from the last discover),
// what the repo holds (B) and what the app uses (C), and runs the
// discover/get/remove/enable operations. Listens on 127.0.0.1 only; mutating
// requests must come from the page itself (same origin + custom header) so
// another site open in the browser can't trigger them.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readManifest, readMeta, setEnabled } from '../lib/meta.mjs'
import { readCatalog } from '../lib/catalog.mjs'
import { editionFiles } from '../lib/editions.mjs'
import { hasAppId } from '../lib/estat.mjs'
import { runChecks } from '../check.mjs'
import { CACHE_DIR } from '../lib/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(HERE, '../cli.mjs')
const COMMANDS = new Set(['discover', 'get', 'remove', 'update', 'check'])
const EDITION_ID = /^[\w.-]{1,40}$/

let running = null   // { command, dataset } while a child process runs

function dirSize(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size
  }
  return total
}

async function status() {
  const meta = readMeta()
  for (const ds of Object.values(meta.datasets)) {
    for (const e of ds.editions ?? []) {
      e.bytes = editionFiles(e).reduce((s, f) => s + (existsSync(f) ? statSync(f).size : 0), 0)
    }
  }
  return {
    now: new Date().toISOString(),
    manifest: readManifest(),
    meta,
    catalog: readCatalog(),
    report: await runChecks(),
    env: { estatAppId: hasAppId() },
    cacheBytes: dirSize(CACHE_DIR),
    running,
  }
}

/** Validates a request body and returns CLI args, or throws. */
function cliArgs({ command, dataset, editions = [], force = false, newer = false, missing = false }) {
  const manifest = readManifest()
  if (!COMMANDS.has(command)) throw new Error(`unknown command: ${command}`)
  if (dataset !== undefined && dataset !== 'all' && !manifest[dataset]) throw new Error('unknown dataset')
  if (!Array.isArray(editions) || !editions.every(e => EDITION_ID.test(e))) throw new Error('bad edition id')
  if ((command === 'get' || command === 'remove') && !dataset) throw new Error('dataset required')
  return [
    command,
    ...(dataset ? [dataset] : []),
    ...editions,
    ...(force ? ['--force'] : []),
    ...(command === 'get' && newer ? ['--newer'] : []),
    ...(command === 'get' && missing ? ['--missing'] : []),
  ]
}

function run(res, body) {
  let args
  try { args = cliArgs(body) } catch (e) { return send(res, 400, { error: e.message }) }
  if (running) return send(res, 409, { error: `実行中です: ${running.label}` })

  running = { label: args.join(' '), started_at: new Date().toISOString() }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.write(`$ npm run data -- ${args.join(' ')}\n`)
  const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, FORCE_COLOR: '0', CHECK_QUIET: '1' } })
  child.stdout.on('data', d => res.write(d))
  child.stderr.on('data', d => res.write(d))
  child.on('close', code => {
    running = null
    res.end(`\n[終了コード ${code}]\n`)
  })
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

async function readBody(req) {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 10_000) throw new Error('too large') }
  return JSON.parse(raw || '{}')
}

export function startUi({ port }) {
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`]
  const server = createServer(async (req, res) => {
    try {
      // Reject requests addressed to any other host name (DNS rebinding).
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return send(res, 403, { error: 'forbidden host' })

      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        return res.end(readFileSync(resolve(HERE, 'index.html')))
      }
      if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, await status())

      if (req.method === 'POST') {
        if (req.headers['x-pipeline-ui'] !== '1' || (req.headers.origin && !origins.includes(req.headers.origin))) {
          return send(res, 403, { error: 'forbidden' })
        }
        const body = await readBody(req)
        if (req.url === '/api/run') return run(res, body)
        if (req.url === '/api/enabled') {
          if (running) return send(res, 409, { error: `実行中です: ${running.label}` })
          const { dataset, editions, enabled } = body
          if (!readManifest()[dataset] || !Array.isArray(editions) || !editions.every(e => EDITION_ID.test(e))) return send(res, 400, { error: 'bad request' })
          setEnabled(dataset, editions, Boolean(enabled))
          return send(res, 200, { ok: true })
        }
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      if (!res.headersSent) send(res, 500, { error: e.message })
      else res.end(`\nエラー: ${e.message}\n`)
    }
  })
  return new Promise(r => server.listen(port, '127.0.0.1', () => {
    console.log(`データ管理 UI: ${origins[0]}  （Ctrl+C で終了）`)
    r()
  }))
}
