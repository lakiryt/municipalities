// Local management UI for the data pipeline: `npm run data -- ui`.
// Shows each dataset's editions, provenance and check results, and can run
// fetch/build/update/check. Listens on 127.0.0.1 only; command requests must
// come from the page itself (same-origin + custom header) so another site
// open in the browser can't trigger them.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readManifest, readMeta } from '../lib/meta.mjs'
import { fetchLog } from '../lib/fetch.mjs'
import { hasAppId } from '../lib/estat.mjs'
import { runChecks } from '../check.mjs'
import { CACHE_DIR, PUBLIC_DIR, ROOT } from '../lib/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(HERE, '../cli.mjs')
const COMMANDS = new Set(['fetch', 'build', 'update', 'check'])

let running = null   // { command, datasets } while a child process runs

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
  // Size of each edition's generated file(s), for the UI.
  for (const ds of Object.values(meta.datasets)) {
    for (const e of ds.editions ?? []) {
      const files = [
        ...[e.path, e.adjacency].filter(Boolean).map(f => resolve(PUBLIC_DIR, f)),
        ...Object.values(e.files ?? {}).map(f => resolve(ROOT, f)),   // repo-relative (src/assets)
      ]
      e.bytes = files.reduce((s, f) => s + (existsSync(f) ? statSync(f).size : 0), 0)
    }
  }
  return {
    now: new Date().toISOString(),
    manifest: readManifest(),
    meta,
    fetchLog: fetchLog(),
    report: await runChecks(),
    env: { estatAppId: hasAppId() },
    cacheBytes: dirSize(CACHE_DIR),
    running,
  }
}

function run(req, res, body) {
  const { command, datasets = [], force = false } = body
  const manifest = readManifest()
  if (!COMMANDS.has(command)) return send(res, 400, { error: `unknown command: ${command}` })
  if (!Array.isArray(datasets) || datasets.some(d => d !== 'all' && !manifest[d])) return send(res, 400, { error: 'unknown dataset' })
  if (running) return send(res, 409, { error: `実行中です: ${running.command} ${running.datasets.join(' ')}` })

  const args = [CLI, command, ...datasets, ...(force ? ['--force'] : [])]
  running = { command, datasets, started_at: new Date().toISOString() }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.write(`$ npm run data -- ${args.slice(1).join(' ')}\n`)
  const child = spawn(process.execPath, args, { env: { ...process.env, FORCE_COLOR: '0' } })
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

export function startUi({ port }) {
  const origin = `http://127.0.0.1:${port}`
  const server = createServer(async (req, res) => {
    try {
      // Reject requests addressed to any other host name (DNS rebinding).
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return send(res, 403, { error: 'forbidden host' })

      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        return res.end(readFileSync(resolve(HERE, 'index.html')))
      }
      if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, await status())

      if (req.method === 'POST' && req.url === '/api/run') {
        const reqOrigin = req.headers.origin
        if (req.headers['x-pipeline-ui'] !== '1' || (reqOrigin && ![origin, `http://localhost:${port}`].includes(reqOrigin))) {
          return send(res, 403, { error: 'forbidden' })
        }
        let raw = ''
        for await (const chunk of req) { raw += chunk; if (raw.length > 10_000) return send(res, 413, { error: 'too large' }) }
        return run(req, res, JSON.parse(raw || '{}'))
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      if (!res.headersSent) send(res, 500, { error: e.message })
      else res.end(`\nエラー: ${e.message}\n`)
    }
  })
  return new Promise(r => server.listen(port, '127.0.0.1', () => {
    console.log(`データ管理 UI: ${origin}  （Ctrl+C で終了）`)
    r()
  }))
}
