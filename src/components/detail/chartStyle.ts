// Chart tokens (see the dataviz reference palette): categorical slots 1–2
// for the series, a hairline grid one step off the surface, and text in
// the text colors — never in a series color.
export const CHART = {
  surface: '#ffffff',
  grid: '#e5e4df',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  series1: '#2a78d6',   // blue — population / 男性
  series2: '#eb6834',   // orange — 女性
}

/** 1,964,034 → "196.4万"; small values as plain numbers. */
export const compactJa = (v: number) =>
  Math.abs(v) >= 10000 ? `${(v / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万` : v.toLocaleString('ja-JP')

/** Rounded "nice" tick values covering [lo, hi] (about `count` of them). */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi === lo) return [lo]
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag
  const ticks = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return ticks
}
