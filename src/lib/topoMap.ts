// Decodes the N03 municipality boundaries TopoJSON into per-code SVG paths,
// projected with a plain spherical Mercator (no external geo library).

const TOPOJSON_PATH = '/maps/N03-20260101.1%25.code.topojson'

export const VIEW_SIZE = 960

type Transform = { scale: [number, number]; translate: [number, number] }

type TopoGeometry = {
  type: 'Polygon' | 'MultiPolygon' | null
  // Polygon: rings of arc indices. MultiPolygon: polygons of rings of arc indices.
  arcs?: number[][] | number[][][]
  properties: { code: string }
}

type Topology = {
  transform?: Transform
  arcs: number[][][]
  objects: Record<string, { geometries: TopoGeometry[] }>
}

type Point = [number, number]

// TopoJSON arcs are delta-encoded integers; each subsequent point is an
// offset from the last, quantized by the shared transform.
function decodeArc(rawArc: number[][], transform?: Transform): Point[] {
  const [sx, sy] = transform?.scale ?? [1, 1]
  const [tx, ty] = transform?.translate ?? [0, 0]
  let x = 0, y = 0
  return rawArc.map(([dx, dy]) => {
    x += dx
    y += dy
    return [x * sx + tx, y * sy + ty]
  })
}

// A negative index ~i means the arc is traversed in reverse.
function arcPoints(index: number, arcs: Point[][]): Point[] {
  if (index >= 0) return arcs[index]
  return [...arcs[~index]].reverse()
}

// Consecutive arcs in a ring share an endpoint, so only the first arc keeps
// its opening point.
function ringPoints(arcIndexes: number[], arcs: Point[][]): Point[] {
  const points: Point[] = []
  arcIndexes.forEach((idx, i) => {
    const pts = arcPoints(idx, arcs)
    points.push(...(i === 0 ? pts : pts.slice(1)))
  })
  return points
}

function geometryRings(geometry: TopoGeometry, arcs: Point[][]): Point[][] {
  if (geometry.type === 'Polygon') {
    return (geometry.arcs as number[][]).map(ring => ringPoints(ring, arcs))
  }
  return (geometry.arcs as number[][][]).flatMap(polygon => polygon.map(ring => ringPoints(ring, arcs)))
}

const mercator = ([lon, lat]: Point): Point => [
  lon * Math.PI / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)),
]

// code (5-digit JIS, no check digit) -> SVG path `d`, already projected and
// fit into a 0..VIEW_SIZE square. A municipality split across islands/exclaves
// shares one code across several geometries, so their paths are concatenated.
export type MuniPaths = Map<string, string>

export async function fetchMunicipalityPaths(): Promise<MuniPaths> {
  const topology: Topology = await fetch(TOPOJSON_PATH).then(r => r.json())
  const arcs = topology.arcs.map(raw => decodeArc(raw, topology.transform))
  const objectKey = Object.keys(topology.objects)[0]
  // Alongside real Polygon/MultiPolygon shapes, the dataset carries many
  // null-type geometries (no `arcs`) that share a code with a real shape —
  // e.g. rows for administrative attributes with no boundary of their own.
  const geometries = topology.objects[objectKey].geometries.filter(
    (g): g is TopoGeometry & { type: 'Polygon' | 'MultiPolygon' } => g.type === 'Polygon' || g.type === 'MultiPolygon'
  )

  const projected = geometries.map(g => ({
    code: g.properties.code,
    rings: geometryRings(g, arcs).map(ring => ring.map(mercator)),
  }))

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const { rings } of projected) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const spanX = maxX - minX, spanY = maxY - minY
  const scale = VIEW_SIZE / Math.max(spanX, spanY)
  const offsetX = (VIEW_SIZE - spanX * scale) / 2
  const offsetY = (VIEW_SIZE - spanY * scale) / 2
  // SVG y grows downward, so north (larger lat -> larger mercator y) must flip.
  const toSvg = ([x, y]: Point): Point => [
    (x - minX) * scale + offsetX,
    VIEW_SIZE - ((y - minY) * scale + offsetY),
  ]

  const paths: MuniPaths = new Map()
  for (const { code, rings } of projected) {
    const d = rings
      .map(ring => `M${ring.map(toSvg).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`)
      .join(' ')
    paths.set(code, (paths.get(code) ?? '') + d)
  }
  return paths
}

// ── Sequential color ramp (blue, 100->700 per the palette) ────────────────────

export const SEQUENTIAL_RAMP = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
]

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b)
  const r = Math.round(pa.r + (pb.r - pa.r) * t)
  const g = Math.round(pa.g + (pb.g - pa.g) * t)
  const bl = Math.round(pa.b + (pb.b - pa.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

// t in [0, 1] -> a color along the sequential ramp.
export function sequentialColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (SEQUENTIAL_RAMP.length - 1)
  const i = Math.min(Math.floor(scaled), SEQUENTIAL_RAMP.length - 2)
  return lerpHex(SEQUENTIAL_RAMP[i], SEQUENTIAL_RAMP[i + 1], scaled - i)
}
