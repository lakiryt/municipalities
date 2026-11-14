// How evaluated cell values are shown. Numbers get thousands separators
// (1,964,034) and keep whatever decimals the expression produced (columns
// round themselves with ROUND()); missing values are an em dash.
const NUMBER = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 6 })

export function formatValue(v: unknown): string {
  if (typeof v === 'number') return Number.isNaN(v) ? '—' : NUMBER.format(v)
  if (typeof v === 'boolean') return v ? '○' : '—'
  return String(v ?? '')
}
