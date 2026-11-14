// How map values become colors. Data differs: population, area and density
// span several orders of magnitude (a linear scale paints all of Japan the
// palest color and a few wards the darkest), while an aging rate or a rent
// is spread evenly. So the scale is chosen per map — automatically from the
// data's spread, or explicitly — instead of one rule for everything.
//
//   linear — position between min and max
//   log    — position between log(min) and log(max) of the positive values;
//            a few zeros (e.g. the uninhabited Northern Territories villages)
//            are allowed and painted in the lowest color
//   rank   — percentile rank (robust to any distribution; equal color areas)
//   diverging — for data with a sign (増減率, 増減数): 0 is the neutral
//            middle, negatives run one way and positives the other, each
//            side stretched to its own extreme (growth and decline differ in
//            size: almost every municipality shrinks). Outliers are clipped by
//            default here, since a single small town's +81% would otherwise
//            wash out every other growth.
//
// `clip` drops the lowest/highest 2% from the scale's range ("outliers"):
// they're still drawn, in the end colors, and the legend says ≤ / ≥.

export type ScaleKind = 'linear' | 'log' | 'rank' | 'diverging'
export type ScaleChoice = ScaleKind | 'auto'

export const SCALE_LABELS: Record<ScaleKind, string> = { linear: '線形', log: '対数', rank: '順位', diverging: '増減' }

export const CLIP_PERCENT = 2

export type ColorScale = {
  kind: ScaleKind
  // Value range the colors span (after clipping); for rank, the data's min/max.
  lo: number
  hi: number
  clippedLow: boolean
  clippedHigh: boolean
  /** Value → position 0..1 along the color ramp (clamped). */
  t: (v: number) => number
  /** Position 0..1 → the value at that point of the legend. */
  valueAt: (t: number) => number
}

/** The q-quantile (0..1) of sorted values, linearly interpolated. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const i = Math.floor(pos), f = pos - i
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i]
}

// Log is offered when at least this share of the values is positive.
const LOG_MIN_POSITIVE_SHARE = 0.95

/** Whether log is possible: (almost) all values positive. */
export function canLog(values: number[]): boolean {
  const positive = values.filter(v => v > 0).length
  return positive >= 2 && positive >= LOG_MIN_POSITIVE_SHARE * values.length
}

/** Whether the data has both signs, so 0 is a meaningful middle. */
export function canDiverge(values: number[]): boolean {
  return values.some(v => v < 0) && values.some(v => v > 0)
}

/**
 * The automatic choice: diverging for data on both sides of 0; log when log is possible and the positive values
 * span more than an order of magnitude between their 5th and 95th
 * percentiles (population, area, density); linear otherwise (rates, rents,
 * wages).
 */
export function suggestScale(values: number[]): ScaleKind {
  if (canDiverge(values)) return 'diverging'
  if (!canLog(values)) return 'linear'
  const positive = values.filter(v => v > 0).sort((a, b) => a - b)
  return quantile(positive, 0.95) / quantile(positive, 0.05) > 10 ? 'log' : 'linear'
}

export function makeScale(values: number[], choice: ScaleChoice, clip: boolean): ColorScale {
  const sorted = [...values].sort((a, b) => a - b)
  let kind: ScaleKind = choice === 'auto' ? suggestScale(sorted) : choice
  if (kind === 'log' && !canLog(sorted)) kind = 'linear'
  if (kind === 'diverging' && !canDiverge(sorted)) kind = 'linear'
  const min = sorted[0] ?? 0, max = sorted.at(-1) ?? 1

  if (kind === 'rank') {
    // Rank of v = share of values below it (ties share the midpoint).
    const n = sorted.length
    const below = (v: number) => {
      let lo = 0, hi = n
      while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m }
      let eq = lo
      while (eq < n && sorted[eq] === v) eq++
      return (lo + eq - 1) / 2
    }
    return {
      kind, lo: min, hi: max, clippedLow: false, clippedHigh: false,
      t: v => (n > 1 ? below(v) / (n - 1) : 0.5),
      valueAt: t => quantile(sorted, t),
    }
  }

  if (kind === 'diverging') {
    // Two slopes meeting at 0: lo..0 → 0..0.5 and 0..hi → 0.5..1. Each side
    // is clipped on its own, so a side with few values (growth, here) keeps
    // its colors instead of being clipped away by the other side's quantiles.
    const neg = sorted.filter(v => v < 0), pos = sorted.filter(v => v > 0)
    const lo = Math.min(0, clip && neg.length ? quantile(neg, CLIP_PERCENT / 100) : min)
    const hi = Math.max(0, clip && pos.length ? quantile(pos, 1 - CLIP_PERCENT / 100) : max)
    return {
      kind, lo, hi,
      clippedLow: min < lo,
      clippedHigh: max > hi,
      t: v => v < 0
        ? (lo < 0 ? 0.5 - 0.5 * Math.min(1, v / lo) : 0.5)
        : (hi > 0 ? 0.5 + 0.5 * Math.min(1, v / hi) : 0.5),
      valueAt: t => (t < 0.5 ? lo * (0.5 - t) * 2 : hi * (t - 0.5) * 2),
    }
  }

  // Log spans the positive values only; anything ≤ 0 clamps to the low end.
  const domain = kind === 'log' ? sorted.filter(v => v > 0) : sorted
  const dMin = domain[0] ?? min, dMax = domain.at(-1) ?? max
  const lo = clip ? quantile(domain, CLIP_PERCENT / 100) : dMin
  const hi = clip ? quantile(domain, 1 - CLIP_PERCENT / 100) : dMax
  const f = kind === 'log' ? Math.log : (x: number) => x
  const fInv = kind === 'log' ? Math.exp : (x: number) => x
  const a = f(lo), b = f(hi)
  return {
    kind, lo, hi,
    clippedLow: min < lo,
    clippedHigh: max > hi,
    t: v => (b === a ? 0.5 : kind === 'log' && v <= 0 ? 0 : Math.max(0, Math.min(1, (f(v) - a) / (b - a)))),
    valueAt: t => fInv(a + (b - a) * t),
  }
}
