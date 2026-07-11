import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const topoPath = resolve(root, 'src/assets/maps/N03-20260101.1%.code.topojson')
const topo = JSON.parse(readFileSync(topoPath, 'utf-8'))

const objectKey = Object.keys(topo.objects)[0]
const geometries = topo.objects[objectKey].geometries

// Arc indices are signed in TopoJSON (negative means the arc is traversed in
// reverse); ~i recovers the unsigned index. Direction doesn't matter here —
// only which municipalities share the arc.
function arcIndexesOf(geometry) {
  return geometry.arcs.flat(2).map(i => (i < 0 ? ~i : i))
}

// A municipality can be split across several Polygon geometries (islands,
// exclaves) that all share the same `code`, so this is keyed by arc, not by
// geometry, and codes are accumulated across all of a municipality's parts.
const arcCodes = new Map()

for (const g of geometries) {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
  const code = g.properties.code
  for (const idx of arcIndexesOf(g)) {
    let codes = arcCodes.get(idx)
    if (!codes) arcCodes.set(idx, codes = new Set())
    codes.add(code)
  }
}

const neighbors = new Map()
const coast = new Set()

for (const g of geometries) {
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
  const code = g.properties.code
  if (!neighbors.has(code)) neighbors.set(code, new Set())
  for (const idx of arcIndexesOf(g)) {
    const codes = arcCodes.get(idx)
    if (codes.size === 1) {
      coast.add(code)
    } else {
      for (const other of codes) {
        if (other !== code) neighbors.get(code).add(other)
      }
    }
  }
}

const allCodes = new Set(geometries.map(g => g.properties.code))
const skipped = [...allCodes].filter(code => !neighbors.has(code))

const adjacency = {}
for (const code of [...neighbors.keys()].sort()) {
  const list = [...neighbors.get(code)].sort()
  if (coast.has(code)) list.push('coast')
  adjacency[code] = list
}

writeFileSync(resolve(root, 'public/maps/adjacency.json'), JSON.stringify(adjacency))
console.log(`Adjacency: ${Object.keys(adjacency).length} municipalities → public/maps/adjacency.json`)
if (skipped.length > 0) {
  console.log(`Skipped (no polygon geometry at this simplification level): ${skipped.join(', ')}`)
}
