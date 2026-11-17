import { isMissing, type Missing, type Value } from '@/lang/value'

// How evaluated cell values are shown. Numbers get thousands separators
// (1,964,034) and keep whatever decimals the expression produced (columns
// round themselves with ROUND()); a missing value shows why it is missing.
const NUMBER = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 6 })

const MISSING_TEXT: Record<Missing['missing'], string> = {
  nodata: '—',
  divzero: '÷0',
  overflow: '桁あふれ',
}

/** A missing value in a cell: short, and told apart by reason. */
export const formatMissing = (m: Missing): string => MISSING_TEXT[m.missing]

/** The sentence behind formatMissing, e.g. for a tooltip. */
export function explainMissing(m: Missing): string {
  switch (m.missing) {
    case 'nodata':   return `データなし（${m.source}）`
    case 'divzero':  return '0で割っているため計算できません'
    case 'overflow': return '値が大きすぎて計算できません'
  }
}

// A plain number (e.g. from a prerendered snapshot) is shown as it is; NaN
// there still reads as no data.
export function formatValue(v: Value | number): string {
  if (isMissing(v)) return formatMissing(v)
  if (typeof v === 'number') return Number.isNaN(v) ? '—' : NUMBER.format(v)
  if (typeof v === 'boolean') return v ? '○' : '×'
  return v
}
