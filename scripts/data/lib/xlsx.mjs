import * as XLSX from 'xlsx'
import { clean } from './text.mjs'

/** All rows of a sheet (by index or name) as arrays, blanks as null. */
export function readSheet(buf, sheet = 0) {
  const wb = XLSX.read(buf)
  const name = typeof sheet === 'number' ? wb.SheetNames[sheet] : sheet
  if (!wb.Sheets[name]) throw new Error(`Sheet "${name}" not found (have: ${wb.SheetNames.join(', ')})`)
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null })
}

/**
 * Builds one label list per column from a multi-row header (rows[from..to)).
 * Merged cells come through as a value in the first cell and nulls after it,
 * so every header row but the last is forward-filled left→right; the last row
 * is taken as-is, since a blank there means "no sub-label", not "same as left".
 * Labels are NFKC-normalized (（）→(), full-width digits → ASCII).
 */
export function headerLabels(rows, from, to) {
  const width = Math.max(...rows.slice(from, to).map(r => r.length))
  const labels = Array.from({ length: width }, () => [])
  for (let r = from; r < to; r++) {
    let carry = null
    const isLast = r === to - 1
    for (let c = 0; c < width; c++) {
      const v = rows[r][c] === null || rows[r][c] === undefined ? null : clean(rows[r][c])
      if (v) carry = v
      const label = v || (isLast ? null : carry)
      if (label && !labels[c].includes(label)) labels[c].push(label)
    }
  }
  return labels
}

/** Index of the single column whose labels include every one of `parts`; throws on 0 or >1 matches unless optional. */
export function findColumn(labels, parts, { optional = false, what = parts.join('/') } = {}) {
  const hits = labels.flatMap((ls, i) => parts.every(p => ls.some(l => l === p || l.includes(p))) ? [i] : [])
  if (hits.length === 1) return hits[0]
  if (hits.length === 0 && optional) return -1
  throw new Error(`Column ${what}: expected 1 match, found ${hits.length}`)
}

/** Excel serial date → "YYYY-MM-DD". */
export function excelDate(serial) {
  if (typeof serial !== 'number') return null
  const d = XLSX.SSF.parse_date_code(serial)
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}
