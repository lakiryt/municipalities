// Prerenders the home page's carousel (maps as SVG + top rows and legends as
// JSON) into public/featured/, from the data already in public/. Runs the
// app's own TypeScript (src/rankings/featuredSnapshot.ts), so nothing is
// computed twice in two ways. Run before dev and build (package.json); the
// output isn't committed.
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { root, withAppModules } from './lib/app-modules.mjs'

const outDir = resolve(root, 'public/featured')
const started = Date.now()

await withAppModules(async load => {
  const { featuredSnapshot } = await load('/src/rankings/featuredSnapshot.ts')
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
})
