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
import { pageHtml } from '../lib/discover.mjs'
import { PUBLIC_DIR, rel } from '../lib/paths.mjs'

const cacheKey = (url) => `map/${url.split('/').pop()}`
const DATALIST = (year) => `https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-${year}.html`

/**
 * The newest year's datalist page lists the nationwide zip of every year:
 *   javascript:DownLd('765.94MB','N03-20260101_GML.zip','../data/N03/N03-2026/N03-20260101_GML.zip',this)
 * Prefecture/region zips (N03-20260101_13_GML.zip) are skipped.
 */
export async function discover(src, opts) {
  let html = null, page = null
  for (let y = new Date().getFullYear() + 1; y >= new Date().getFullYear() - 2 && !html; y--) {
    try { page = DATALIST(y); html = await pageHtml(page, opts) } catch { html = null }
  }
  if (!html) throw new Error('国土数値情報 N03 の一覧ページが見つかりません')
  const editions = []
  for (const m of html.matchAll(/DownLd\('([^']*)',\s*'(N03-(\d{4})(\d{2})(\d{2})_GML\.zip)',\s*'([^']+)'/g)) {
    const asOf = `${m[3]}-${m[4]}-${m[5]}`
    if (asOf < src.discover_from || editions.some(e => e.id === asOf)) continue
    editions.push({ id: asOf, as_of: asOf, label: `${asOf}（${m[1]}）`, ref: { url: new URL(m[6], page).href, as_of: asOf, size: m[1] } })
  }
  return editions
}

export async function fetchEdition(src, ref, opts) {
  await download(ref.url, cacheKey(ref.url), opts)
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

export async function buildEdition(src, ref, opts) {
  const require = createRequire(import.meta.url)
  const mapshaperBin = require.resolve('mapshaper/bin/mapshaper')
  const zip = cachePath(cacheKey(ref.url))
  if (!existsSync(zip)) throw new Error(`Not in cache: ${cacheKey(ref.url)}`)
  const shp = extractShapefile(zip, cachePath(`map/${ref.as_of}`), opts.log)

  const topoAbs = resolve(PUBLIC_DIR, `data/map/${ref.as_of}.topojson`)
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
  const adj = writeJson(resolve(PUBLIC_DIR, `data/map/${ref.as_of}.adjacency.json`), adjacency)

  return {
    id: ref.as_of, as_of: ref.as_of,
    path: rel(topoAbs).replace(/^public\//, ''),
    adjacency: adj.file.replace(/^public\//, ''),
    rows: Object.keys(adjacency).length,
    source: provenance(cacheKey(ref.url)),
  }
}
