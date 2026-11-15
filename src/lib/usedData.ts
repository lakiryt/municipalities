// Which datasets a set of expressions (columns, filter, sort, map) actually
// draws on — so the page can show "データ：…" chips and an 出典 line only for
// the data on screen. Derived variables (#popdensity, #inc_rate, …) are
// expanded into the variables they're defined from.
import { DERIVED, DATA_VARS } from '@/lang/variables'
import type { DataKey } from '@/data/datasets'

const DERIVED_EXPR = new Map<string, string>(DERIVED.map(d => [d.name, d.expr]))

// The dataset each non-population number comes from — every one must say
// (a new variable in DATA_VARS doesn't compile until it's listed here).
type DataVar = typeof DATA_VARS[number]
const DATASET_OF: Record<DataVar, DataKey> = {
  area: 'area',
  rent_inc0: 'rent',
  rent_exc0: 'rent',
  rent_private: 'rent',
  minwage: 'minwage',
  pop_from: 'change',
  pop_to: 'change',
}

const isDataVar = (v: string): v is DataVar => (DATA_VARS as readonly string[]).includes(v)

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
      const def = DERIVED_EXPR.get(m[1])
      if (def) queue.push(def)
    }
  }
  const selectable = new Set<DataKey>()
  for (const v of numeric) {
    if (DERIVED_EXPR.has(v)) continue
    selectable.add(isDataVar(v) ? DATASET_OF[v] : 'pop')
  }
  const all = expressions.join(' ')
  return {
    selectable,
    designations: /&(seirei|chukaku|tokurei)\b/.test(all),
    coastal: /&coastal\b/.test(all),
  }
}
