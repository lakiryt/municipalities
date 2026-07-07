export type ExploreState = {
  columns: { label: string; expression: string }[]
  filterExpression: string
  sortExpression: string
  sortDirection: 'asc' | 'desc'
}

export function encodeExploreState(state: ExploreState): string {
  return JSON.stringify(state)
}

// Untrusted input (hand-edited or shared URL) — validate shape and drop
// anything malformed instead of throwing during render.
export function decodeExploreState(raw: string | null): ExploreState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.columns)) return null
    const columns = parsed.columns.filter(
      (c: unknown): c is { label: string; expression: string } =>
        typeof c === 'object' && c !== null &&
        typeof (c as { label?: unknown }).label === 'string' &&
        typeof (c as { expression?: unknown }).expression === 'string'
    )
    if (columns.length === 0) return null
    return {
      columns,
      filterExpression: typeof parsed.filterExpression === 'string' ? parsed.filterExpression : '',
      sortExpression: typeof parsed.sortExpression === 'string' ? parsed.sortExpression : '',
      sortDirection: parsed.sortDirection === 'asc' ? 'asc' : 'desc',
    }
  } catch {
    return null
  }
}
