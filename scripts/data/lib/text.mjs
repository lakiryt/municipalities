// Japanese government CSVs are a mix of Shift_JIS (CP932) and UTF-8, rarely
// labelled. Decode as UTF-8 when the bytes are valid UTF-8, otherwise as
// Shift_JIS — a Shift_JIS file of any real size is essentially never valid UTF-8.
export function decodeText(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buf.subarray(3))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('shift_jis').decode(buf)
  }
}

/** NFKC + trim — folds full-width digits/spaces and half-width kana. */
export const clean = (s) => (s ?? '').toString().normalize('NFKC').trim()

/** Parses a number from a cell that may contain commas, spaces, or be blank/"-"/"…". */
export function toNumber(v) {
  if (typeof v === 'number') return v
  const s = clean(v).replace(/,/g, '')
  if (s === '' || s === '-' || s === '…' || s === '...' || s === 'X' || s === 'x') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
