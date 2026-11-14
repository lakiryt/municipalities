const OFFICIAL_LABEL = '政令市の区を除く'

// A short, human description of the filter for its toolbar chip: the parts
// of a top-level AND it recognizes (a prefecture, a kind, &official),
// otherwise just "条件あり".
export function describeFilter(expression: string): string {
  const labels = topLevelAnd(expression.replace(/\s+/g, '')).map(p =>
    p === '&official' ? OFFICIAL_LABEL : p.match(/^EQ\(\$(?:prefkanji|kind),"([^"]+)"\)$/)?.[1] ?? null)
  if (labels.some(l => l === null)) return '条件あり'
  // A prefecture or kind says more than &official, so it goes first.
  return labels.sort((a, b) => Number(a === OFFICIAL_LABEL) - Number(b === OFFICIAL_LABEL)).join('・')
}

/** AND(a, b, …) → [a, b, …]; anything else → [expression]. */
function topLevelAnd(expression: string): string[] {
  if (!expression.startsWith('AND(') || !expression.endsWith(')')) return [expression]
  const inner = expression.slice(4, -1)
  const out: string[] = []
  let depth = 0, quoted = false, start = 0
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === '"') quoted = !quoted
    else if (!quoted && c === '(') depth++
    else if (!quoted && c === ')') depth--
    else if (!quoted && depth === 0 && c === ',') { out.push(inner.slice(start, i)); start = i + 1 }
  }
  out.push(inner.slice(start))
  return out
}
