// Which datasets a set of expressions (columns, filter, sort, map) actually
// draws on — so the page can show "データ：…" chips and an 出典 line only for
// the data on screen. Read from the typed expressions (not their text), with
// derived variables (#popdensity, #inc_rate, …) expanded into the variables
// they're defined from and a column reference into its column's expression.
import type { NumVarName } from '@/lang/variables'
import { variablesOf, type TypedExpr } from '@/lang/expr'
import { derivedDef } from '@/lang/derived'
import { datasetOf } from '@/data/schema'
import type { DataKey } from '@/data/datasets'

export type UsedData = {
  selectable: Set<DataKey>
  designations: boolean   // &seirei / &chukaku / &tokurei
  coastal: boolean        // &coastal (from the map's adjacency data)
}

/** What the given expressions use (an absent one — none, or invalid — uses nothing). */
export function usedData(expressions: (TypedExpr | null | undefined)[]): UsedData {
  const numeric = new Set<NumVarName>()
  const bools = new Set<string>()
  const queue = expressions.filter((t): t is TypedExpr => t != null)
  while (queue.length) {
    const vars = variablesOf(queue.pop()!)
    for (const b of vars.bool) bools.add(b)
    for (const v of vars.num) {
      if (numeric.has(v)) continue
      numeric.add(v)
      const def = derivedDef(v)
      if (def) queue.push(def.typed)
    }
  }
  const selectable = new Set<DataKey>()
  for (const v of numeric) {
    const key = datasetOf(v)
    if (key) selectable.add(key)
  }
  return {
    selectable,
    designations: bools.has('seirei') || bools.has('chukaku') || bools.has('tokurei'),
    coastal: bools.has('coastal'),
  }
}
