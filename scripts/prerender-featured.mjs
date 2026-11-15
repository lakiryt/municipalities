// Prerenders the home page's carousel (maps as SVG + top rows and legends as
// JSON) into public/featured/, from the data already in public/. Runs the
// app's own TypeScript through Vite, so nothing is computed twice in two
// ways. Run before dev and build (package.json); the output isn't committed.
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const outDir = resolve(publicDir, 'featured')

// The app fetches its data from the site root (`/data/…`); here that is public/.
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (!url.startsWith('/')) return realFetch(input, init)
  const file = resolve(publicDir, decodeURIComponent(url.slice(1).split('?')[0]))
  if (!file.startsWith(publicDir)) throw new Error(`outside public/: ${url}`)
  return new Response(await readFile(file))
}

const started = Date.now()
const vite = await createServer({ root, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null } })
try {
  const { featuredSnapshot } = await vite.ssrLoadModule('/src/rankings/featuredSnapshot.ts')
  const { snapshot, svgs } = await featuredSnapshot()
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })
  await writeFile(resolve(outDir, 'index.json'), JSON.stringify(snapshot))
  let bytes = 0
  for (const [name, svg] of Object.entries(svgs)) {
    await writeFile(resolve(outDir, name), svg)
    bytes += svg.length
  }
  console.log(`Featured: ${Object.keys(svgs).length} maps (${Math.round(bytes / 1024)} KB) → public/featured/ in ${Date.now() - started} ms`)
} finally {
  await vite.close()
}
