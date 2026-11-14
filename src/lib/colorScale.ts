// How map values become colors. Data differs: population, area and density
// span several orders of magnitude (a linear scale paints all of Japan the
// palest color and a few wards the darkest), while an aging rate or a rent
// is spread evenly, and a change (増減率, 増減数) has a sign. So the scale is
// chosen per map — automatically from the data, or explicitly — and every
// scale follows the same rules whatever the column is.
//
// Unsigned data (light → dark):
//   linear — position between min and max
//   log    — position between log(min) and log(max) of the positive values;
//            a few zeros (e.g. the uninhabited Northern Territories villages)
//            are allowed and painted in the lowest color
//   rank   — percentile rank (robust to any distribution; equal color areas)
// Signed data (0 is the neutral middle; negatives one way, positives the
// other, each side stretched to its own extreme):
//   diverging — linear on each side
//   symlog    — the signed counterpart of log: asinh(v / c), linear for
//               |v| up to about c (the median |v|) and logarithmic beyond, so
//               a few large values don't wash out the rest
//
// Automatic: log for positive data whose spread (95th / 5th percentile) is
// more than 10×; for data with both signs, symlog when |v| spreads that
// much, diverging otherwise; linear for the rest.
//
// `clipPercent` (0 = off) takes the lowest and highest p% of the values out of
// the scale's range: they're still drawn, in the end colors, and the legend
// says ≤ / ≥. Same meaning on every scale (not applicable to rank).

export type ScaleKind = 'linear' | 'log' | 'rank' | 'diverging' | 'symlog'
export type ScaleChoice = ScaleKind | 'auto'

export const SCALE_LABELS: Record<ScaleKind, string> = {
  linear: '線形', log: '対数', rank: '順位', diverging: '増減・線形', symlog: '増減・対称対数',
}

export const isSigned = (kind: ScaleKind) => kind === 'diverging' || kind === 'symlog'

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
// "Spans orders of magnitude": 95th / 5th percentile above this.
const WIDE_SPREAD = 10

/** Whether log is possible: (almost) all values positive. */
export function canLog(values: number[]): boolean {
  const positive = values.filter(v => v > 0).length
  return positive >= 2 && positive >= LOG_MIN_POSITIVE_SHARE * values.length
}

/** Whether the data has both signs, so 0 is a meaningful middle. */
export function canDiverge(values: number[]): boolean {
  return values.some(v => v < 0) && values.some(v => v > 0)
}

const wideSpread = (positive: number[]) => {
  const s = [...positive].sort((a, b) => a - b)
  return quantile(s, 0.95) / quantile(s, 0.05) > WIDE_SPREAD
}

export function suggestScale(values: number[]): ScaleKind {
  if (canDiverge(values)) return wideSpread(values.filter(v => v !== 0).map(Math.abs)) ? 'symlog' : 'diverging'
  if (!canLog(values)) return 'linear'
  return wideSpread(values.filter(v => v > 0)) ? 'log' : 'linear'
}

export function makeScale(values: number[], choice: ScaleChoice, clipPercent = 0): ColorScale {
  const sorted = [...values].sort((a, b) => a - b)
  let kind: ScaleKind = choice === 'auto' ? suggestScale(sorted) : choice
  if (kind === 'log' && !canLog(sorted)) kind = 'linear'
  if (isSigned(kind) && !canDiverge(sorted)) kind = 'linear'
  const min = sorted[0] ?? 0, max = sorted.at(-1) ?? 1
  const p = Math.max(0, Math.min(49, clipPercent)) / 100

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

  if (isSigned(kind)) {
    // Two slopes meeting at 0: lo..0 → 0..0.5 and 0..hi → 0.5..1, through f
    // (identity, or asinh for symlog). Clipping takes the same p% off each
    // end as on any scale; if that cuts past 0, the whole side is "outside"
    // and drawn in its end color.
    const qLo = p > 0 ? quantile(sorted, p) : min
    const qHi = p > 0 ? quantile(sorted, 1 - p) : max
    const lo = Math.min(0, qLo), hi = Math.max(0, qHi)
    const absSorted = sorted.filter(v => v !== 0).map(Math.abs).sort((a, b) => a - b)
    const c = kind === 'symlog' ? quantile(absSorted, 0.5) || 1 : 1
    const f = kind === 'symlog' ? (v: number) => Math.asinh(v / c) : (v: number) => v
    const fInv = kind === 'symlog' ? (y: number) => c * Math.sinh(y) : (y: number) => y
    const fLo = f(lo), fHi = f(hi)
    return {
      kind, lo, hi,
      clippedLow: min < lo,
      clippedHigh: max > hi,
      t: v => v < 0 ? (fLo < 0 ? 0.5 - 0.5 * Math.min(1, f(v) / fLo) : 0)
        : v > 0 ? (fHi > 0 ? 0.5 + 0.5 * Math.min(1, f(v) / fHi) : 1)
        : 0.5,
      valueAt: t => (t < 0.5 ? fInv(fLo * (0.5 - t) * 2) : fInv(fHi * (t - 0.5) * 2)),
    }
  }

  // Log spans the positive values only; anything ≤ 0 clamps to the low end.
  const domain = kind === 'log' ? sorted.filter(v => v > 0) : sorted
  const dMin = domain[0] ?? min, dMax = domain.at(-1) ?? max
  const lo = p > 0 ? quantile(domain, p) : dMin
  const hi = p > 0 ? quantile(domain, 1 - p) : dMax
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
