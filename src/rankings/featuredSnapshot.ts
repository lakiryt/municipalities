// The home carousel, worked out ahead of time (scripts/prerender-featured.mjs
// runs this through Vite at dev start and at build): each featured ranking's
// first rows, its legend, and its map as one small SVG — so the home page
// needs neither the 7MB boundary file nor the full municipality data.
// Everything is computed by the same code the ranking pages use.
import { parseAndTypeCheck } from '@/lang/expr'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, buildItems, type BaseItem } from '@/data/municipalities'
import {
  fetchArea, fetchPopulation, fetchRent, fetchMinWages, fetchDesignations, fetchCoastal, fetchMunicipalityCodes, fetchPopulationChange,
  defaultDataSelection, type DesignationSets,
} from '@/data/datasets'
import { fetchMunicipalityPaths, sequentialColor, COLOR_SCHEMES, DIVERGING_RAMP } from '@/lib/topoMap'
import { makeScale, isSigned, asFinite, rampPosition, ZERO, type Finite } from '@/lib/colorScale'
import { featuredRankings, type Featured } from './featured'

export type FeaturedSnapshot = {
  // width ÷ height of every map (one frame for all), so the page can hold
  // the space before an image arrives
  aspect: number
  // keyed by the ranking's path (Featured.path)
  slides: Record<string, {
    svg: string                // file name under /featured/
    top: { code: string; name: string; pref: string; value: number }[]
    legend: { lo: number; hi: number; zeroAt: number | null; ramp: readonly string[] }
  }>
}

const TOP = 5
const NO_DATA_FILL = '#e1e0d9'
// Colors are snapped to this many steps along the ramp, so shapes of one
// color become one <path> (finer than the eye tells apart at this size).
const COLOR_STEPS = 64
// Coordinates are kept to 1/PRECISION of a map unit (the map is 960 units
// across; the home page shows it ~550px wide).
const PRECISION = 2

export async function loadDefaultItems() {
  const sel = defaultDataSelection()
  const [pop, area, codes, rent, minwage, change, designations, coastal] = await Promise.all([
    fetchPopulation(sel.pop), fetchArea(sel.area), fetchMunicipalityCodes(), fetchRent(sel.rent),
    fetchMinWages(sel.minwage), fetchPopulationChange(sel.change), fetchDesignations(), fetchCoastal(),
  ])
  return { items: buildItems(pop, area, codes, rent, minwage, change), designations, coastal }
}

/** The ranking's starting filter, its map column's values, and its first rows in its own order. */
export function evaluateFeatured(f: Featured, items: BaseItem[], designations: DesignationSets | undefined, coastal: Set<string>) {
  const column = f.config.columns.find(c => c.id === f.mapColumn)!
  const value = parseAndTypeCheck(column.expression)
  const filter = f.config.filterExpression ? parseAndTypeCheck(f.config.filterExpression) : null
  const sort = parseAndTypeCheck(f.config.sortExpression)
  const sign = f.config.sortDirection === 'desc' ? -1 : 1

  const values = new Map<string, Finite>()
  const ranked: { item: BaseItem; value: Finite; key: number }[] = []
  for (const item of items) {
    const env = baseItemEnv(item, designations, coastal)
    if (filter && evaluate(filter, env) !== true) continue
    const v = asFinite(evaluate(value, env) as number)
    if (v === undefined) continue   // missing, or a ratio over zero: no color (as in the map view)
    values.set(item.code, v)
    const key = evaluate(sort, env) as number
    if (!Number.isNaN(key)) ranked.push({ item, value: v, key })
  }
  ranked.sort((a, b) => sign * (a.key - b.key))
  return { values, top: ranked.slice(0, TOP) }
}

// "M1.0,2.0L3.0,4.0Z M…" (topoMap's output) → rings of rounded points, with
// repeats dropped and rings too small to show left out.
function roundRings(d: string): [number, number][][] {
  const rings: [number, number][][] = []
  for (const part of d.split('M').slice(1)) {
    const pts: [number, number][] = []
    for (const xy of part.replace(/Z\s*$/, '').split('L')) {
      const [x, y] = xy.split(',').map(n => Math.round(Number(n) * PRECISION))
      const last = pts[pts.length - 1]
      if (!last || last[0] !== x || last[1] !== y) pts.push([x, y])
    }
    if (pts.length >= 3) rings.push(pts)
  }
  return rings
}

// Relative commands with small integers: far shorter than absolute decimals.
function ringPath(ring: [number, number][]): string {
  let s = `M${ring[0][0]} ${ring[0][1]}l`
  for (let i = 1; i < ring.length; i++) s += `${ring[i][0] - ring[i - 1][0]} ${ring[i][1] - ring[i - 1][1]} `
  return s.trimEnd().replace(/ -/g, '-') + 'z'
}

export async function featuredSnapshot(): Promise<{ snapshot: FeaturedSnapshot; svgs: Record<string, string> }> {
  const { items, designations, coastal } = await loadDefaultItems()
  const paths = await fetchMunicipalityPaths()
  const parentOf = new Map(items.filter(i => i.parent).map(i => [i.code, i.parent]))
  const rings = new Map([...paths].map(([code, d]) => [code, roundRings(d)]))

  // One frame for every map: the land's bounds.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const rs of rings.values()) for (const r of rs) for (const [x, y] of r) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  const pad = 8 * PRECISION
  const [w, h] = [x1 - x0 + 2 * pad, y1 - y0 + 2 * pad]
  const viewBox = `${x0 - pad} ${y0 - pad} ${w} ${h}`

  const snapshot: FeaturedSnapshot = { aspect: Math.round((w / h) * 1000) / 1000, slides: {} }
  const svgs: Record<string, string> = {}
  for (const f of featuredRankings()) {
    const { values, top } = evaluateFeatured(f, items, designations, coastal)
    const scale = makeScale([...values.values()], 'auto')
    // A featured slide with nothing to color is broken (data or config):
    // stop the build rather than ship an empty map.
    if (!scale) throw new Error(`featured ranking ${f.path}: no value to map in column @${f.mapColumn}`)
    const signed = isSigned(scale.kind)
    const ramp = signed ? DIVERGING_RAMP : COLOR_SCHEMES.blue.ramp

    // Same rule as the map view: a shape shows its own code's value, or (a
    // designated city's ward) its city's.
    const byFill = new Map<string, string[]>()
    for (const [code, rs] of rings) {
      if (rs.length === 0) continue
      const v = values.get(code) ?? values.get(parentOf.get(code) ?? '')
      const fill = v === undefined ? NO_DATA_FILL : sequentialColor(rampPosition(Math.round(scale.t(v) * COLOR_STEPS) / COLOR_STEPS), ramp)
      const list = byFill.get(fill) ?? []
      for (const r of rs) list.push(ringPath(r))
      byFill.set(fill, list)
    }
    const name = `${f.path.split('/').pop()}.svg`
    // Each color also strokes itself thinly, which closes the hairline
    // seams antialiasing leaves between neighbors (not a border: same color).
    svgs[name] =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" stroke-width="${PRECISION * 0.6}" stroke-linejoin="round">` +
      [...byFill].map(([fill, ds]) => `<path fill="${fill}" stroke="${fill}" d="${ds.join('')}"/>`).join('') +
      '</svg>'

    snapshot.slides[f.path] = {
      svg: name,
      top: top.map(({ item, value }) => ({ code: item.code, name: item.kanji, pref: item.prefecture.kanji ?? '', value })),
      legend: { lo: scale.lo, hi: scale.hi, zeroAt: signed ? scale.t(ZERO) : null, ramp },
    }
  }
  return { snapshot, svgs }
}
