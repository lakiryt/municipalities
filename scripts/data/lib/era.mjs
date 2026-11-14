// Japanese era dates as they appear in column headers and cells:
// "令和8年7月1日", "令和元年10月1日", "令和元年7月" (day omitted), "平成31年4月1日",
// "昭和31年9月1日". Returns "YYYY-MM-DD" or null.
const ERAS = { 令和: 2018, 平成: 1988, 昭和: 1925, 大正: 1911, 明治: 1867 }

export function parseEraDate(s) {
  const m = (s ?? '').normalize('NFKC').match(/(令和|平成|昭和|大正|明治)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(?:(\d+)\s*日)?/)
  if (!m) return null
  const year = ERAS[m[1]] + (m[2] === '元' ? 1 : Number(m[2]))
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(m[3])}-${pad(m[4] ?? 1)}`
}
