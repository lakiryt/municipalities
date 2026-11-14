// Municipality adjacency from a TopoJSON: two municipalities are neighbors
// when they share an arc; a municipality with an arc used by nobody else
// borders the sea (or the national boundary) and gets the pseudo-neighbor
// "coast". (Moved from the former scripts/generate-adjacency.mjs.)

// Arc indices are signed in TopoJSON (negative means the arc is traversed in
// reverse); ~i recovers the unsigned index. Direction doesn't matter here —
// only which municipalities share the arc.
const arcIndexesOf = (geometry) => geometry.arcs.flat(2).map(i => (i < 0 ? ~i : i))

/** Returns { adjacency: {code: [neighbor..., 'coast'?]}, skipped: codes with no polygon }. */
export function computeAdjacency(topo) {
  const objectKey = Object.keys(topo.objects)[0]
  const geometries = topo.objects[objectKey].geometries
  const isPolygon = (g) => g.type === 'Polygon' || g.type === 'MultiPolygon'

  // A municipality can be split across several Polygon geometries (islands,
  // exclaves) that all share the same `code`, so this is keyed by arc, not by
  // geometry, and codes are accumulated across all of a municipality's parts.
  const arcCodes = new Map()
  for (const g of geometries.filter(isPolygon)) {
    for (const idx of arcIndexesOf(g)) {
      let codes = arcCodes.get(idx)
      if (!codes) arcCodes.set(idx, codes = new Set())
      codes.add(g.properties.code)
    }
  }

  const neighbors = new Map()
  const coast = new Set()
  for (const g of geometries.filter(isPolygon)) {
    const code = g.properties.code
    if (!neighbors.has(code)) neighbors.set(code, new Set())
    for (const idx of arcIndexesOf(g)) {
      const codes = arcCodes.get(idx)
      if (codes.size === 1) coast.add(code)
      else for (const other of codes) if (other !== code) neighbors.get(code).add(other)
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
  return { adjacency, skipped }
}
