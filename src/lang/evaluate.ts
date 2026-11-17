import type { NumExpr, BoolExpr, StrExpr, TypedExpr, TypedNum, TypedBool, TypedStr } from './expr'
import { NUM_VARS, STR_VARS, BOOL_VARS, recordOf, type NumVarName, type StrVarName, type BoolVarName } from './variables'
import {
  isMissing, firstReason, checked, nodata, DIVZERO,
  type Finite, type Missing, type Num, type Bool, type Str, type Value,
} from './value'

// A row's values for every declared variable (where the data has none, the
// value says so — lang/value.ts; the name itself always exists).
export type Env = {
  numvars: Record<NumVarName, Num>
  strvars: Record<StrVarName, Str>
  boolvars: Record<BoolVarName, Bool>
  // Only populated when evaluating a filter/sort expression (the only place
  // `@id` col-refs can occur — a column's own TypedExpr never contains one,
  // so this never recurses back into itself).
  columns?: { id: number; typed: TypedExpr }[]
}

function resolveColRef(id: number, env: Env): TypedExpr | undefined {
  return env.columns?.find(c => c.id === id)?.typed
}

// Evaluates every operand; the numbers if all are present, otherwise why not.
function operands(args: NumExpr[], env: Env): Finite[] | Missing {
  const values: Finite[] = []
  let missing: Missing | null = null
  for (const a of args) {
    const v = evaluateNum(a, env)
    if (isMissing(v)) missing = firstReason(missing, v)
    else values.push(v)
  }
  return missing ?? values
}

function evaluateNum(expr: NumExpr, env: Env): Num {
  switch (expr.kind) {
    case 'literal': return expr.value
    case 'numvar':  return env.numvars[expr.name]
    case 'SUM':     { const vs = operands(expr.args, env); return isMissing(vs) ? vs : checked(vs.reduce((acc, v) => acc + v, 0)) }
    case 'MULT':    { const vs = operands(expr.args, env); return isMissing(vs) ? vs : checked(vs.reduce((acc, v) => acc * v, 1)) }
    case 'MIN':     { const vs = operands(expr.args, env); return isMissing(vs) ? vs : checked(Math.min(...vs)) }
    case 'MAX':     { const vs = operands(expr.args, env); return isMissing(vs) ? vs : checked(Math.max(...vs)) }
    case 'NEG':     { const v = evaluateNum(expr.arg, env); return isMissing(v) ? v : checked(-v) }
    case 'INV':     { const v = evaluateNum(expr.arg, env); return isMissing(v) ? v : v === 0 ? DIVZERO : checked(1 / v) }
    case 'ROUND':   {
      const v = evaluateNum(expr.arg, env)
      const f = Math.pow(10, expr.digits)
      return isMissing(v) ? v : checked(Math.round(v * f) / f)
    }
    case 'IF':      { const c = evaluateBool(expr.cond, env); return isMissing(c) ? c : c ? evaluateNum(expr.then, env) : evaluateNum(expr.else_, env) }
    case 'colref':  { const t = resolveColRef(expr.id, env); return t?.type === 'n' ? evaluateNum(t.expr, env) : nodata(`@${expr.id}`) }
  }
}

// Three-valued (Kleene) logic: a comparison with a missing side is missing,
// and so is its NOT; AND is false if any operand is false (whatever the
// others are), OR is true if any is true. A filter keeps only `true`, so
// `a < b`, `a != b` and NOT(...) all leave out a row whose value is missing.
function evaluateBool(expr: BoolExpr, env: Env): Bool {
  switch (expr.kind) {
    case 'AND': {
      let missing: Missing | null = null
      for (const a of expr.args) {
        const v = evaluateBool(a, env)
        if (v === false) return false
        if (isMissing(v)) missing = firstReason(missing, v)
      }
      return missing ?? true
    }
    case 'OR': {
      let missing: Missing | null = null
      for (const a of expr.args) {
        const v = evaluateBool(a, env)
        if (v === true) return true
        if (isMissing(v)) missing = firstReason(missing, v)
      }
      return missing ?? false
    }
    case 'NOT':     { const v = evaluateBool(expr.arg, env); return isMissing(v) ? v : !v }
    case 'LEQ':     { const vs = operands([expr.left, expr.right], env); return isMissing(vs) ? vs : vs[0] <= vs[1] }
    case 'EQ': {
      const l = evaluate(expr.left, env), r = evaluate(expr.right, env)
      if (isMissing(l)) return isMissing(r) ? firstReason(l, r) : l
      return isMissing(r) ? r : l === r
    }
    case 'boolvar': return env.boolvars[expr.name]
    case 'IF':      { const c = evaluateBool(expr.cond, env); return isMissing(c) ? c : c ? evaluateBool(expr.then, env) : evaluateBool(expr.else_, env) }
    case 'colref':  { const t = resolveColRef(expr.id, env); return t?.type === 'b' ? evaluateBool(t.expr, env) : nodata(`@${expr.id}`) }
  }
}

function evaluateStr(expr: StrExpr, env: Env): Str {
  switch (expr.kind) {
    case 'strlit': return expr.value
    case 'strvar': return env.strvars[expr.name]
    case 'SUBSTR': {
      const s = evaluateStr(expr.str, env)
      if (isMissing(s)) return s
      const len = evaluateNum(expr.len, env)
      if (isMissing(len)) return len
      const n = Math.trunc(len)
      return n >= 0 ? s.slice(0, n) : s.slice(n)
    }
    case 'IF': { const c = evaluateBool(expr.cond, env); return isMissing(c) ? c : c ? evaluateStr(expr.then, env) : evaluateStr(expr.else_, env) }
    case 'colref': { const t = resolveColRef(expr.id, env); return t?.type === 's' ? evaluateStr(t.expr, env) : nodata(`@${expr.id}`) }
  }
}

// Typed entry points: a caller that knows the expression's type gets that
// type's values, with no cast.
export const evalNum = (t: TypedNum, env: Env): Num => evaluateNum(t.expr, env)
export const evalBool = (t: TypedBool, env: Env): Bool => evaluateBool(t.expr, env)
export const evalStr = (t: TypedStr, env: Env): Str => evaluateStr(t.expr, env)

export function evaluate(expr: TypedExpr, env: Env): Value {
  switch (expr.type) {
    case 'n': return evaluateNum(expr.expr, env)
    case 'b': return evaluateBool(expr.expr, env)
    case 's': return evaluateStr(expr.expr, env)
  }
}

/** Whether a filter keeps the row: only when its condition is true (not false, not missing). */
export const keeps = (filter: TypedBool, env: Env): boolean => evalBool(filter, env) === true

/** Every variable missing — a starting point to fill in. */
export const blankEnv = (): Env => ({
  numvars: recordOf(NUM_VARS, v => nodata(`#${v}`)),
  strvars: recordOf(STR_VARS, v => nodata(`$${v}`)),
  boolvars: recordOf(BOOL_VARS, v => nodata(`&${v}`)),
})
