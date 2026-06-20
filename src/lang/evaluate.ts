import type { NumExpr, BoolExpr, StrExpr, TypedExpr } from './expr'

export type Env = {
  numvars: Record<string, number>
  strvars: Record<string, string>
}

function evaluateNum(expr: NumExpr, env: Env): number {
  switch (expr.kind) {
    case 'literal': return expr.value
    case 'numvar':  return (env.numvars[expr.name] as number | undefined) ?? 0
    case 'SUM':     return expr.args.reduce((acc, a) => acc + evaluateNum(a, env), 0)
    case 'MULT':    return expr.args.reduce((acc, a) => acc * evaluateNum(a, env), 1)
    case 'NEG':     return -evaluateNum(expr.arg, env)
    case 'INV':     return 1 / evaluateNum(expr.arg, env)
  }
}

function evaluateBool(expr: BoolExpr, env: Env): boolean {
  switch (expr.kind) {
    case 'AND': return expr.args.every(a => evaluateBool(a, env))
    case 'OR':  return expr.args.some(a => evaluateBool(a, env))
    case 'NOT': return !evaluateBool(expr.arg, env)
    case 'LEQ': return evaluateNum(expr.left, env) <= evaluateNum(expr.right, env)
    case 'EQ':  return evaluate(expr.left, env) === evaluate(expr.right, env)
  }
}

function evaluateStr(expr: StrExpr, env: Env): string {
  switch (expr.kind) {
    case 'strlit': return expr.value
    case 'strvar': return (env.strvars[expr.name] as string | undefined) ?? ''
  }
}

export function evaluate(expr: TypedExpr, env: Env): number | boolean | string {
  switch (expr.type) {
    case 'n': return evaluateNum(expr.expr, env)
    case 'b': return evaluateBool(expr.expr, env)
    case 's': return evaluateStr(expr.expr, env)
  }
}
