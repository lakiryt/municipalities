// Runs `fn` with the app's own TypeScript modules loadable from Node, through
// Vite (path aliases, TS, JSON imports all as in the app). The app fetches
// its data from the site root (`/data/…`); here that is read from public/.
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const publicDir = resolve(root, 'public')

export async function withAppModules(fn) {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (!url.startsWith('/')) return realFetch(input, init)
    const file = resolve(publicDir, decodeURIComponent(url.slice(1).split('?')[0]))
    if (!file.startsWith(publicDir)) throw new Error(`outside public/: ${url}`)
    return new Response(await readFile(file))
  }
  const vite = await createServer({ root, appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null } })
  try {
    return await fn(path => vite.ssrLoadModule(path))
  } finally {
    await vite.close()
    globalThis.fetch = realFetch
  }
}
