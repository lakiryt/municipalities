// Which datasets a set of expressions (columns, filter, sort, map) actually
// draws on — so the page can show "データ：…" chips and an 出典 line only for
// the data on screen. Derived variables (#popdensity, #inc_rate, …) are
// expanded into the variables they're defined from.
import { derivedExpressions } from '@/data/municipalities'
import type { DataKey } from '@/data/datasets'

const DERIVED = new Map(derivedExpressions.map(d => [d.name, d.expr]))

// Numeric variables that don't come from the population datasets.
const NON_POPULATION: Record<string, DataKey> = {
  area: 'area',
  rent_inc0: 'rent',
  rent_exc0: 'rent',
  minwage: 'minwage',
  pop_from: 'change',
  pop_to: 'change',
}

export type UsedData = {
  selectable: Set<DataKey>
  designations: boolean   // &seirei / &chukaku / &tokurei
  coastal: boolean        // &coastal (from the map's adjacency data)
}

export function usedData(expressions: string[]): UsedData {
  const numeric = new Set<string>()
  const queue = [...expressions]
  while (queue.length) {
    const expr = queue.pop()!
    for (const m of expr.matchAll(/#([A-Za-z0-9_]+)/g)) {
      if (numeric.has(m[1])) continue
      numeric.add(m[1])
      const def = DERIVED.get(m[1])
      if (def) queue.push(def)
    }
  }
  const selectable = new Set<DataKey>()
  for (const v of numeric) {
    if (DERIVED.has(v)) continue
    selectable.add(NON_POPULATION[v] ?? 'pop')
  }
  const all = expressions.join(' ')
  return {
    selectable,
    designations: /&(seirei|chukaku|tokurei)\b/.test(all),
    coastal: /&coastal\b/.test(all),
  }
}
