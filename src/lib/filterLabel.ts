import type { BoolExpr, TypedBool, TypedExpr } from '@/lang/expr'

const OFFICIAL_LABEL = '政令市の区を除く'

// A short, human description of the filter for its toolbar chip: the parts
// of a top-level AND it recognizes (a prefecture, a kind, &official),
// otherwise just "条件あり". Read from the parsed filter, so it doesn't
// matter how it's written (`$kind = "町"` or `EQ($kind, "町")`).
export function describeFilter(filter: TypedBool): string {
  const labels = conjuncts(filter.expr).map(label)
  if (labels.some(l => l === null)) return '条件あり'
  // A prefecture or kind says more than &official, so it goes first.
  return labels.sort((a, b) => Number(a === OFFICIAL_LABEL) - Number(b === OFFICIAL_LABEL)).join('・')
}

/** a AND (b AND c) → [a, b, c]; anything else → [it]. */
const conjuncts = (e: BoolExpr): BoolExpr[] => (e.kind === 'AND' ? e.args.flatMap(conjuncts) : [e])

/** A prefecture or kind (either side of `=`), &official, or null for anything else. */
function label(e: BoolExpr): string | null {
  if (e.kind === 'boolvar') return e.name === 'official' ? OFFICIAL_LABEL : null
  if (e.kind !== 'EQ') return null
  return named(e.left, e.right) ?? named(e.right, e.left)
}

const named = (v: TypedExpr, lit: TypedExpr): string | null =>
  v.type === 's' && v.expr.kind === 'strvar' && (v.expr.name === 'prefkanji' || v.expr.name === 'kind') &&
  lit.type === 's' && lit.expr.kind === 'strlit' ? lit.expr.value : null
