import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { sha256 } from './fetch.mjs'
import { rel } from './paths.mjs'

/** RFC 4180 parser (quoted fields, embedded commas/newlines, CRLF). Returns string[][]. */
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const formatCell = (v) => {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Writes the pipeline's normalized CSV: UTF-8 (no BOM), LF, header row,
 * missing values as empty cells. `rows` are objects keyed by `columns`.
 * Returns a small summary for meta.json.
 */
export function writeCsv(absPath, columns, rows) {
  const lines = [columns.join(','), ...rows.map(r => columns.map(c => formatCell(r[c])).join(','))]
  const text = lines.join('\n') + '\n'
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, text)
  return { file: rel(absPath), rows: rows.length, sha256: sha256(Buffer.from(text)) }
}

/** Writes JSON (compact unless `pretty`) and returns the same summary shape as writeCsv. */
export function writeJson(absPath, data, { pretty = false } = {}) {
  const text = (pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + '\n'
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, text)
  return { file: rel(absPath), sha256: sha256(Buffer.from(text)) }
}
