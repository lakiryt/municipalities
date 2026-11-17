// The derived variables (lang/variables.ts), parsed and checked once.
import { parseAndTypeCheck, variablesOf, type TypedNum, type Closed } from './expr'
import { DERIVED, type NumVarName } from './variables'

export type DerivedDef = { name: NumVarName; typed: TypedNum<Closed> }

// Each is a number, and uses only variables defined before it — so computing
// them in this order never reads one not yet computed, and none depends on
// itself. Checked as the module loads: a mistake fails every test and build.
export function checkDerived(defs: readonly { name: NumVarName; expr: string }[]): DerivedDef[] {
  return defs.map((d, i) => {
    const typed = parseAndTypeCheck(d.expr)
    if (typed.type !== 'n') throw new Error(`派生変数 #${d.name} が数値ではありません`)
    const notYet = new Set<string>(defs.slice(i).map(x => x.name))
    for (const v of variablesOf(typed).num)
      if (notYet.has(v)) throw new Error(`派生変数 #${d.name} が、まだ定義されていない #${v} を使っています`)
    return { name: d.name, typed }
  })
}

export const DERIVED_DEFS: readonly DerivedDef[] = checkDerived(DERIVED)

const byName = new Map<string, DerivedDef>(DERIVED_DEFS.map(d => [d.name, d]))
export const derivedDef = (name: NumVarName): DerivedDef | undefined => byName.get(name)
