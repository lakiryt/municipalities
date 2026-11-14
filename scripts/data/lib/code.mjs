// Everything the pipeline writes is keyed by the 5-digit 標準地域コード.
// Sources variously use: the 5-digit code; a 4-digit code with the leading
// zero dropped (国土地理院 面積調, Excel number cells); or the 6-digit
// 地方公共団体コード = 5 digits + a JIS X0401/0402 check digit (住基, 最低賃金).

export function checkDigit(code5) {
  const weights = [6, 5, 4, 3, 2]
  const sum = code5.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
  const cd = 11 - (sum % 11)
  return cd === 10 ? 0 : cd === 11 ? 1 : cd
}

/**
 * Normalizes any of the above to a 5-digit string, or returns null if the
 * input isn't a code at all (blank, subtotal labels, etc.). A 6-digit input
 * must carry a valid check digit — otherwise it's a misread column, and
 * silently truncating it would mis-key a row.
 */
export function toCode5(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).normalize('NFKC').trim()
  if (!/^\d{1,6}$/.test(s)) return null
  if (s.length === 6) {
    const code5 = s.slice(0, 5)
    if (checkDigit(code5) !== Number(s[5])) throw new Error(`Invalid check digit in 6-digit code "${s}"`)
    return code5
  }
  if (s.length === 5) return s
  // 1–4 digits: a 5-digit code that lost its leading zero(s) — only ever the
  // prefecture part can start with 0 (01–09), so at most one is missing.
  if (s.length === 4) return s.padStart(5, '0')
  return null
}

/** 2-digit prefecture code → that prefecture's own 5-digit code ("13" → "13000"). */
export const prefCode5 = (pref2) => `${String(pref2).padStart(2, '0')}000`
