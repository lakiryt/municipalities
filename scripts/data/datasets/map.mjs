// 国土数値情報 行政区域 (N03): boundaries → simplified TopoJSON + adjacency.
// Equivalent to the manual step previously in README:
//   mapshaper N03-20260101.geojson -snap -clean -simplify weighted 1%
//     -filter-fields N03_007 -rename-fields code=N03_007 -o output.topojson
// The zip carries GML, Shapefile and GeoJSON; only the Shapefile is extracted
// (much smaller than the GeoJSON, and mapshaper would otherwise import both).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { download, cachePath, provenance } from '../lib/fetch.mjs'
import { writeJson } from '../lib/csv.mjs'
import { computeAdjacency } from '../lib/adjacency.mjs'
import { PUBLIC_DIR, rel } from '../lib/paths.mjs'

const cacheKey = (url) => `map/${url.split('/').pop()}`

export async function fetchRaw(src, opts) {
  for (const e of src.editions) await download(e.url, cacheKey(e.url), opts)
}

function extractShapefile(zipPath, outDir, log) {
  mkdirSync(outDir, { recursive: true })
  const patterns = ['*.shp', '*.shx', '*.dbf', '*.prj', '*.cpg']
  // `unzip` ships with macOS, most Linux, and Git for Windows; Windows' own
  // bsdtar (tar.exe) can also read zips.
  let r = spawnSync('unzip', ['-o', '-j', '-q', zipPath, ...patterns, '-d', outDir], { stdio: 'inherit' })
  if (r.error || r.status !== 0) {
    log('  unzip が使えないため tar で展開します')
    r = spawnSync('tar', ['-xf', zipPath, '-C', outDir, ...patterns.map(p => `--include=${p}`)], { stdio: 'inherit' })
    if (r.error || r.status !== 0) throw new Error(`zip の展開に失敗しました: ${zipPath}`)
  }
  const shp = readdirSync(outDir).find(f => f.endsWith('.shp'))
  if (!shp) throw new Error(`Shapefile not found in ${zipPath}`)
  return resolve(outDir, shp)
}

export async function build(src, opts) {
  const require = createRequire(import.meta.url)
  const mapshaperBin = require.resolve('mapshaper/bin/mapshaper')
  const editions = []
  for (const e of src.editions) {
    const zip = cachePath(cacheKey(e.url))
    if (!existsSync(zip)) throw new Error(`Not in cache: ${cacheKey(e.url)} — run \`npm run data -- fetch map\` first`)
    const shp = extractShapefile(zip, cachePath(`map/${e.as_of}`), opts.log)

    const topoAbs = resolve(PUBLIC_DIR, `data/map/${e.as_of}.topojson`)
    opts.log(`  mapshaper (simplify ${src.simplify}) … 数分かかります`)
    const r = spawnSync(process.execPath, [
      '--max-old-space-size=8192', mapshaperBin,
      '-i', shp,
      '-snap', '-clean',
      '-simplify', 'weighted', src.simplify,
      '-filter-fields', 'N03_007',
      '-rename-fields', 'code=N03_007',
      '-rename-layers', 'municipalities',
      '-o', topoAbs, 'format=topojson',
    ], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('mapshaper failed')

    const topo = JSON.parse(readFileSync(topoAbs, 'utf-8'))
    const { adjacency, skipped } = computeAdjacency(topo)
    if (skipped.length) opts.log(`  note    図形が消えたコード（簡略化で潰れた等）: ${skipped.join(', ')}`)
    const adj = writeJson(resolve(PUBLIC_DIR, `data/map/${e.as_of}.adjacency.json`), adjacency)

    editions.push({
      id: e.as_of, as_of: e.as_of,
      path: rel(topoAbs).replace(/^public\//, ''),
      adjacency: adj.file.replace(/^public\//, ''),
      rows: Object.keys(adjacency).length,
      source: provenance(cacheKey(e.url)),
    })
  }
  return { editions }
}
