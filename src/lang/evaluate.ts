import type { NumExpr, BoolExpr, StrExpr, TypedExpr } from './expr'

export type Env = {
  numvars: Record<string, number>
  strvars: Record<string, string>
  boolvars: Record<string, boolean>
  // Only populated when evaluating a filter/sort expression (the only place
  // `@id` col-refs can occur — a column's own TypedExpr never contains one,
  // so this never recurses back into itself).
  columns?: { id: number; typed: TypedExpr }[]
}

function resolveColRef(id: number, env: Env): TypedExpr | undefined {
  return env.columns?.find(c => c.id === id)?.typed
}

function evaluateNum(expr: NumExpr, env: Env): number {
  switch (expr.kind) {
    case 'literal': return expr.value
    case 'numvar':  return (env.numvars[expr.name] as number | undefined) ?? NaN
    case 'SUM':     return expr.args.reduce((acc, a) => acc + evaluateNum(a, env), 0)
    case 'MULT':    return expr.args.reduce((acc, a) => acc * evaluateNum(a, env), 1)
    case 'NEG':     return -evaluateNum(expr.arg, env)
    case 'INV':     return 1 / evaluateNum(expr.arg, env)
    case 'ROUND':   { const f = Math.pow(10, evaluateNum(expr.digits, env)); return Math.round(evaluateNum(expr.arg, env) * f) / f }
    case 'IF':      return evaluateBool(expr.cond, env) ? evaluateNum(expr.then, env) : evaluateNum(expr.else_, env)
    case 'colref':  { const t = resolveColRef(expr.id, env); return t?.type === 'n' ? evaluateNum(t.expr, env) : NaN }
  }
}

function evaluateBool(expr: BoolExpr, env: Env): boolean {
  switch (expr.kind) {
    case 'AND':     return expr.args.every(a => evaluateBool(a, env))
    case 'OR':      return expr.args.some(a => evaluateBool(a, env))
    case 'NOT':     return !evaluateBool(expr.arg, env)
    case 'LEQ':     return evaluateNum(expr.left, env) <= evaluateNum(expr.right, env)
    case 'EQ':      return evaluate(expr.left, env) === evaluate(expr.right, env)
    case 'boolvar': return (env.boolvars[expr.name] as boolean | undefined) ?? false
    case 'IF':      return evaluateBool(expr.cond, env) ? evaluateBool(expr.then, env) : evaluateBool(expr.else_, env)
    case 'colref':  { const t = resolveColRef(expr.id, env); return t?.type === 'b' ? evaluateBool(t.expr, env) : false }
  }
}

function evaluateStr(expr: StrExpr, env: Env): string {
  switch (expr.kind) {
    case 'strlit': return expr.value
    case 'strvar': return (env.strvars[expr.name] as string | undefined) ?? ''
    case 'SUBSTR': {
      const s = evaluateStr(expr.str, env)
      const n = Math.trunc(evaluateNum(expr.len, env))
      return n >= 0 ? s.slice(0, n) : s.slice(n)
    }
    case 'IF': return evaluateBool(expr.cond, env) ? evaluateStr(expr.then, env) : evaluateStr(expr.else_, env)
    case 'colref': { const t = resolveColRef(expr.id, env); return t?.type === 's' ? evaluateStr(t.expr, env) : '' }
  }
}

export function evaluate(expr: TypedExpr, env: Env): number | boolean | string {
  switch (expr.type) {
    case 'n': return evaluateNum(expr.expr, env)
    case 'b': return evaluateBool(expr.expr, env)
    case 's': return evaluateStr(expr.expr, env)
  }
}
