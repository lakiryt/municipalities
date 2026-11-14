// Zooming the map to a filtered set of municipalities.

export type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * Bounds to zoom to for a set of municipalities: their union, leaving out
 * any whose center is an outlier (beyond 1.5×IQR from the quartiles) — so
 * filtering to 東京都 frames Tokyo, not Tokyo plus the Ogasawara Islands
 * 1,000 km to the south.
 */
export function fitBounds(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  const fences = (vs: number[]) => {
    const s = [...vs].sort((a, b) => a - b)
    const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]
    const iqr = q(0.75) - q(0.25)
    return [q(0.25) - 1.5 * iqr, q(0.75) + 1.5 * iqr]
  }
  const cx = boxes.map(b => (b.x0 + b.x1) / 2), cy = boxes.map(b => (b.y0 + b.y1) / 2)
  const [fx0, fx1] = fences(cx), [fy0, fy1] = fences(cy)
  const kept = boxes.filter((_, i) => cx[i] >= fx0 && cx[i] <= fx1 && cy[i] >= fy0 && cy[i] <= fy1)
  const use = kept.length ? kept : boxes
  return {
    x0: Math.min(...use.map(b => b.x0)), y0: Math.min(...use.map(b => b.y0)),
    x1: Math.max(...use.map(b => b.x1)), y1: Math.max(...use.map(b => b.y1)),
  }
}
