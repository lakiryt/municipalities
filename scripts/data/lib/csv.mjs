import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PUBLIC_DIR, rel } from './paths.mjs'

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

function writeText(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, text)
}

/** The pipeline's CSV format: UTF-8 (no BOM), LF, header row, missing values as empty cells. */
export const toCsv = (columns, rows) =>
  [columns.join(','), ...rows.map(r => columns.map(c => formatCell(r[c])).join(','))].join('\n') + '\n'

/** Where an edition's generated file lives, relative to public/ (as stored in meta.json). */
export const dataPath = (dataset, filename) => `data/${dataset}/${filename}`

/**
 * Writes one edition's CSV to public/data/<dataset>/<edition>.csv.
 * Returns { path (relative to public/, for meta.json), rows }.
 */
export function writeDataCsv(dataset, edition, columns, rows) {
  const path = dataPath(dataset, `${edition}.csv`)
  writeText(resolve(PUBLIC_DIR, path), toCsv(columns, rows))
  return { path, rows: rows.length }
}

/** Writes JSON to public/data/<dataset>/<filename>; returns its path relative to public/. */
export function writeDataJson(dataset, filename, data) {
  const path = dataPath(dataset, filename)
  writeText(resolve(PUBLIC_DIR, path), JSON.stringify(data) + '\n')
  return path
}

/** Writes pretty JSON anywhere in the repo (bundled assets); returns the repo-relative path. */
export function writeRepoJson(absPath, data) {
  writeText(absPath, JSON.stringify(data, null, 2) + '\n')
  return rel(absPath)
}
