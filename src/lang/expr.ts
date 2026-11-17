import { isNumVar, isStrVar, isBoolVar, type NumVarName, type StrVarName, type BoolVarName } from './variables'
// ── Raw parse tree (untyped) ──────────────────────────────────────────────────

// `op` is set when the call was written as an operator (`a + b` is SUM(a, b)):
// it names what the user wrote, for error messages.
type RawCall    = { kind: 'call';    name: string; args: RawExpr[]; op?: string }
type RawLiteral = { kind: 'literal'; value: number }
type RawVar     = { kind: 'numvar';     name: string }
type RawStrLit  = { kind: 'strlit';  value: string }
type RawStrVar  = { kind: 'strvar';  name: string }
type RawBoolVar = { kind: 'boolvar'; name: string }
type RawColRef  = { kind: 'colref'; id: number }
type RawExpr    = RawCall | RawLiteral | RawVar | RawStrLit | RawStrVar | RawBoolVar | RawColRef

// ── Typed AST ─────────────────────────────────────────────────────────────────

export type NumLiteral = { kind: 'literal'; value: number }
export type NumVar     = { kind: 'numvar';  name: NumVarName }
export type NumSum     = { kind: 'SUM';     args: NumExpr[] }
export type NumMult    = { kind: 'MULT';    args: NumExpr[] }
export type NumMin     = { kind: 'MIN';     args: NumExpr[] }
export type NumMax     = { kind: 'MAX';     args: NumExpr[] }
export type NumNeg     = { kind: 'NEG';     arg: NumExpr }
export type NumInv     = { kind: 'INV';     arg: NumExpr }
export type NumRound   = { kind: 'ROUND';   arg: NumExpr; digits: NumExpr }
export type NumIf      = { kind: 'IF'; cond: BoolExpr; then: NumExpr;  else_: NumExpr }
export type NumColRef  = { kind: 'colref'; id: number }
export type NumExpr    = NumLiteral | NumVar | NumSum | NumMult | NumMin | NumMax | NumNeg | NumInv | NumRound | NumIf | NumColRef

export type BoolAnd  = { kind: 'AND';     args: BoolExpr[] }
export type BoolOr   = { kind: 'OR';      args: BoolExpr[] }
export type BoolNot  = { kind: 'NOT';     arg: BoolExpr }
export type BoolLeq  = { kind: 'LEQ';     left: NumExpr;   right: NumExpr }
export type BoolEq   = { kind: 'EQ';      left: TypedExpr; right: TypedExpr }
export type BoolVar  = { kind: 'boolvar'; name: BoolVarName }
export type BoolIf   = { kind: 'IF'; cond: BoolExpr; then: BoolExpr; else_: BoolExpr }
export type BoolColRef = { kind: 'colref'; id: number }
export type BoolExpr = BoolAnd | BoolOr | BoolNot | BoolLeq | BoolEq | BoolVar | BoolIf | BoolColRef

export type StrLiteral = { kind: 'strlit'; value: string }
export type StrVar     = { kind: 'strvar'; name: StrVarName }
export type StrSubstr  = { kind: 'SUBSTR'; str: StrExpr;   len: NumExpr }
export type StrIf      = { kind: 'IF'; cond: BoolExpr; then: StrExpr;  else_: StrExpr }
export type StrColRef  = { kind: 'colref'; id: number }
export type StrExpr    = StrLiteral | StrVar | StrSubstr | StrIf | StrColRef

// Type of the column being referenced by `@id` — supplied by the caller
// (only where column references are allowed) so the type checker can
// resolve `@id`'s type without needing to know the whole column's AST.
export type ColumnTypeInfo = { id: number; type: 'n' | 'b' | 's' }

export type TypedNum  = { type: 'n'; expr: NumExpr }
export type TypedBool = { type: 'b'; expr: BoolExpr }
export type TypedStr  = { type: 's'; expr: StrExpr }
export type TypedExpr = TypedNum | TypedBool | TypedStr

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type TokIdent   = { kind: 'ident';   value: string }
type TokNumber  = { kind: 'number';  value: number }
type TokVar     = { kind: 'numvar';  name: string }
type TokStrLit  = { kind: 'strlit'; value: string }
type TokStrVar  = { kind: 'strvar'; name: string }
type TokBoolVar = { kind: 'boolvar'; name: string }
type TokColRef  = { kind: 'colref'; id: number }
type TokLParen  = { kind: 'lparen' }
type TokRParen  = { kind: 'rparen' }
type TokComma   = { kind: 'comma' }
type TokOp      = { kind: 'op'; value: SymbolOp }
type TokEof     = { kind: 'eof' }
type Token = TokIdent | TokNumber | TokVar | TokStrLit | TokStrVar | TokBoolVar | TokColRef | TokLParen | TokRParen | TokComma | TokOp | TokEof

type SymbolOp = '+' | '-' | '*' | '/' | '=' | '!=' | '<=' | '>='
type InfixOp = SymbolOp | 'AND' | 'OR'

const japaneseDescriptions: Record<Token['kind'], string> = {
  ident:   '識別子',
  number:  '数値',
  numvar:  '数値変数',
  strlit:  '文字列リテラル',
  strvar:  '文字列変数',
  boolvar: '真偽値変数',
  colref:  '列参照',
  lparen:  '左括弧',
  rparen:  '右括弧',
  comma:   'カンマ',
  op:      '演算子',
  eof:     '式の終わり',
}

const describe = (tok: Token): string =>
  tok.kind === 'op' ? `演算子「${tok.value}」` : japaneseDescriptions[tok.kind]

export class ParseError extends Error {}
export class TypeCheckError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (/\s/.test(ch)) { i++; continue }

    if (/[A-Z]/.test(ch)) {
      let j = i
      while (j < input.length && /[A-Z]/.test(input[j])) j++
      tokens.push({ kind: 'ident', value: input.slice(i, j) })
      i = j
      continue
    }

    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < input.length && /[0-9]/.test(input[j])) j++
      if (j < input.length && input[j] === '.') {
        j++
        while (j < input.length && /[0-9]/.test(input[j])) j++
      }
      tokens.push({ kind: 'number', value: Number(input.slice(i, j)) })
      i = j
      continue
    }

    if (ch === '#') {
      let j = i + 1
      while (j < input.length && /[a-z0-9_]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「#」の後には小文字のアルファベットまたはアンダースコアが必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'numvar', name: input.slice(i + 1, j) })
      i = j
      continue
    }

    if (ch === '$') {
      let j = i + 1
      while (j < input.length && /[a-z0-9_]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「$」の後には小文字のアルファベットまたはアンダースコアが必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'strvar', name: input.slice(i + 1, j) })
      i = j
      continue
    }

    if (ch === '&') {
      let j = i + 1
      while (j < input.length && /[a-z0-9_]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「&」の後には小文字のアルファベットまたはアンダースコアが必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'boolvar', name: input.slice(i + 1, j) })
      i = j
      continue
    }

    if (ch === '"') {
      let j = i + 1
      while (j < input.length && input[j] !== '"') j++
      if (j >= input.length) throw new ParseError(`文字列リテラルが閉じられていません（${i + 1}文字目の「"」に対応する閉じ引用符がありません）`)
      tokens.push({ kind: 'strlit', value: input.slice(i + 1, j) })
      i = j + 1
      continue
    }

    if (ch === '@') {
      let j = i + 1
      while (j < input.length && /[0-9]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「@」の後には列ID（数字）が必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'colref', id: Number(input.slice(i + 1, j)) })
      i = j
      continue
    }

    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue }
    if (ch === ',') { tokens.push({ kind: 'comma'  }); i++; continue }

    const two = input.slice(i, i + 2)
    if (two === '!=' || two === '<=' || two === '>=') { tokens.push({ kind: 'op', value: two }); i += 2; continue }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '=') { tokens.push({ kind: 'op', value: ch }); i++; continue }
    // `a < b` as NOT(b <= a) would be true when either side is missing (NaN),
    // so it isn't offered until the core has a comparison of its own.
    if (ch === '<' || ch === '>')
      throw new ParseError(`「${ch}」は使えません。「<=」か「>=」を使ってください（${i + 1}文字目）`)

    throw new ParseError(`式に使用できない文字「${ch}」が用いられています（${i + 1}文字目）`)
  }

  tokens.push({ kind: 'eof' })
  return tokens
}

// ── Parser (recursive descent, operators by binding power) ──────────────────

// Operators are notation for the core functions: `a - b` is SUM(a, NEG(b)),
// `a / b` is MULT(a, INV(b)), `a >= b` is LEQ(b, a). The typed AST and the
// evaluator know nothing of them. A higher binding power binds tighter;
// comparisons don't associate (`a <= b <= c` is an error, not a guess).
const INFIX: Record<InfixOp, { bp: number; assoc: 'left' | 'none' }> = {
  'OR':  { bp: 1, assoc: 'left' },
  'AND': { bp: 2, assoc: 'left' },
  '=':   { bp: 3, assoc: 'none' },
  '!=':  { bp: 3, assoc: 'none' },
  '<=':  { bp: 3, assoc: 'none' },
  '>=':  { bp: 3, assoc: 'none' },
  '+':   { bp: 4, assoc: 'left' },
  '-':   { bp: 4, assoc: 'left' },
  '*':   { bp: 5, assoc: 'left' },
  '/':   { bp: 5, assoc: 'left' },
}
const PREFIX_MINUS_BP = 6

// What an error message calls each operator's operands.
const ADD = '足し算・引き算'
const MUL = '掛け算・割り算'

const call = (name: string, args: RawExpr[], op: string): RawCall => ({ kind: 'call', name, args, op })

// `a + b + c` is one SUM(a, b, c), as one would write it by hand. Only the
// left operand is merged, so the terms are still taken left to right.
function extend(name: string, op: string, left: RawExpr, right: RawExpr): RawCall {
  return left.kind === 'call' && left.name === name && left.op === op
    ? call(name, [...left.args, right], op)
    : call(name, [left, right], op)
}

function infix(op: InfixOp, left: RawExpr, right: RawExpr): RawExpr {
  switch (op) {
    case '+':   return extend('SUM', ADD, left, right)
    case '-':   return extend('SUM', ADD, left, call('NEG', [right], '引き算'))
    case '*':   return extend('MULT', MUL, left, right)
    case '/':   return extend('MULT', MUL, left, call('INV', [right], '割り算'))
    case 'AND': return extend('AND', '「AND」', left, right)
    case 'OR':  return extend('OR', '「OR」', left, right)
    case '=':   return call('EQ', [left, right], '「=」')
    case '!=':  return call('NOT', [call('EQ', [left, right], '「!=」')], '「!=」')
    case '<=':  return call('LEQ', [left, right], '「<=」')
    case '>=':  return call('LEQ', [right, left], '「>=」')
  }
}

class Parser {
  private pos = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token { return this.tokens[this.pos] }

  private consume(): Token { return this.tokens[this.pos++] }

  private expect(kind: Token['kind']): Token {
    const tok = this.consume()
    if (tok.kind !== kind) throw new ParseError(`〈${japaneseDescriptions[kind]}〉が来るべきところ〈${describe(tok)}〉でした`)
    return tok
  }

  // AND and OR are words: after an operand they are operators, and before
  // `(` at the start of an operand they are still the functions.
  private infixOp(tok: Token): InfixOp | null {
    if (tok.kind === 'op') return tok.value
    if (tok.kind === 'ident' && (tok.value === 'AND' || tok.value === 'OR')) return tok.value
    return null
  }

  parseExpr(minBp = 0): RawExpr {
    let left = this.parseOperand()
    for (;;) {
      const op = this.infixOp(this.peek())
      if (op === null || INFIX[op].bp < minBp) return left
      this.consume()
      const { bp, assoc } = INFIX[op]
      left = infix(op, left, this.parseExpr(bp + 1))
      const next = this.infixOp(this.peek())
      if (assoc === 'none' && next !== null && INFIX[next].bp === bp)
        throw new ParseError(`「${op}」と「${next}」は続けて書けません。括弧でくくってください`)
    }
  }

  private parseOperand(): RawExpr {
    const tok = this.peek()

    if (tok.kind === 'number') {
      this.consume()
      return { kind: 'literal', value: tok.value }
    }

    if (tok.kind === 'numvar') {
      this.consume()
      return { kind: 'numvar', name: tok.name }
    }

    if (tok.kind === 'strlit') {
      this.consume()
      return { kind: 'strlit', value: tok.value }
    }

    if (tok.kind === 'strvar') {
      this.consume()
      return { kind: 'strvar', name: tok.name }
    }

    if (tok.kind === 'boolvar') {
      this.consume()
      return { kind: 'boolvar', name: tok.name }
    }

    if (tok.kind === 'colref') {
      this.consume()
      return { kind: 'colref', id: tok.id }
    }

    if (tok.kind === 'op' && tok.value === '-') {
      this.consume()
      const operand = this.parseExpr(PREFIX_MINUS_BP)
      // `-3` is the number -3 (so ROUND(x, -2) reads as written).
      return operand.kind === 'literal'
        ? { kind: 'literal', value: -operand.value }
        : call('NEG', [operand], '符号の「-」')
    }

    if (tok.kind === 'lparen') {
      this.consume()
      const inner = this.parseExpr()
      const closing = this.peek()
      if (closing.kind !== 'rparen')
        throw new ParseError(`(...)を閉じる〈右括弧〉がないまま〈${describe(closing)}〉となりました`)
      this.consume()
      return inner
    }

    if (tok.kind === 'ident') {
      this.consume()
      this.expect('lparen')
      const args: RawExpr[] = []
      if (this.peek().kind !== 'rparen') {
        args.push(this.parseExpr())
        while (this.peek().kind === 'comma') {
          this.consume()
          args.push(this.parseExpr())
        }
      }
      const closing = this.peek()
      if (closing.kind !== 'rparen')
        throw new ParseError(`${tok.value}(...)を閉じる〈右括弧〉がないまま〈${describe(closing)}〉となりました`)
      this.consume()
      return { kind: 'call', name: tok.value, args }
    }

    throw new ParseError(`〈${describe(tok)}〉が正しくない場所で使用されています`)
  }

  parse(): RawExpr {
    const expr = this.parseExpr()
    const remaining = this.peek()
    if (remaining.kind !== 'eof') {
      throw new ParseError(`式が終了しているにもかかわらず、後ろに〈${describe(remaining)}〉が続いています`)
    }
    return expr
  }
}

// ── Type checker ──────────────────────────────────────────────────────────────

const typeLabel = (t: TypedExpr): string =>
  t.type === 'n' ? '数値' : t.type === 'b' ? '真偽値' : '文字列'

function requireNum(raw: RawExpr, context: string, columns: ColumnTypeInfo[] | undefined): NumExpr {
  const t = typeCheck(raw, columns)
  if (t.type !== 'n') throw new TypeCheckError(`${context}: 数値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireBool(raw: RawExpr, context: string, columns: ColumnTypeInfo[] | undefined): BoolExpr {
  const t = typeCheck(raw, columns)
  if (t.type !== 'b') throw new TypeCheckError(`${context}: 真偽値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireStr(raw: RawExpr, context: string, columns: ColumnTypeInfo[] | undefined): StrExpr {
  const t = typeCheck(raw, columns)
  if (t.type !== 's') throw new TypeCheckError(`${context}: 文字列であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

// `columns` is only passed by callers where `@id` column references are
// allowed (filter/sort expressions); when it's undefined, `@id` is rejected
// outright. This keeps column expressions themselves free of the concept
// entirely, which is what makes them safe from reference cycles — a column
// can never depend on another column, only on filter/sort can depend on columns.
function typeCheck(raw: RawExpr, columns: ColumnTypeInfo[] | undefined): TypedExpr {
  if (raw.kind === 'literal') {
    return { type: 'n', expr: { kind: 'literal', value: raw.value } }
  }

  // A variable must be one of the declared ones (lang/variables.ts): a typo
  // is an error here rather than a value that is silently always missing.
  if (raw.kind === 'numvar') {
    if (!isNumVar(raw.name)) throw new TypeCheckError(`数値変数「#${raw.name}」はありません`)
    return { type: 'n', expr: { kind: 'numvar', name: raw.name } }
  }

  if (raw.kind === 'strlit') {
    return { type: 's', expr: { kind: 'strlit', value: raw.value } }
  }

  if (raw.kind === 'strvar') {
    if (!isStrVar(raw.name)) throw new TypeCheckError(`文字列変数「$${raw.name}」はありません`)
    return { type: 's', expr: { kind: 'strvar', name: raw.name } }
  }

  if (raw.kind === 'boolvar') {
    if (!isBoolVar(raw.name)) throw new TypeCheckError(`真偽値変数「&${raw.name}」はありません`)
    return { type: 'b', expr: { kind: 'boolvar', name: raw.name } }
  }

  if (raw.kind === 'colref') {
    if (!columns) throw new TypeCheckError('「@」列参照はフィルター・並べ替えの式でのみ使用できます')
    const col = columns.find(c => c.id === raw.id)
    if (!col) throw new TypeCheckError(`列ID「@${raw.id}」に対応する列が見つかりません`)
    if (col.type === 'n') return { type: 'n', expr: { kind: 'colref', id: raw.id } }
    if (col.type === 'b') return { type: 'b', expr: { kind: 'colref', id: raw.id } }
    return { type: 's', expr: { kind: 'colref', id: raw.id } }
  }

  const { name, args, op } = raw
  // What an error points at: the operator as written, or the function's argument.
  const at = (i: number) => op ? `${op}の項` : `${name}の${i + 1}番目の引数`

  const arity = (n: number) => {
    if (args.length !== n)
      throw new TypeCheckError(`${name}が受けつける引数は${n}個ですが、${args.length}個与えられました`)
  }

  switch (name) {
    case 'AND':
      return { type: 'b', expr: { kind: 'AND', args: args.map((a: RawExpr, i: number) => requireBool(a, at(i), columns)) } }
    case 'OR':
      return { type: 'b', expr: { kind: 'OR',  args: args.map((a: RawExpr, i: number) => requireBool(a, at(i), columns)) } }
    case 'NOT':
      arity(1)
      return { type: 'b', expr: { kind: 'NOT', arg: requireBool(args[0], at(0), columns) } }
    case 'LEQ':
      arity(2)
      return { type: 'b', expr: { kind: 'LEQ', left: requireNum(args[0], at(0), columns), right: requireNum(args[1], at(1), columns) } }
    case 'EQ': {
      arity(2)
      const left = typeCheck(args[0], columns)
      const right = typeCheck(args[1], columns)
      if (left.type !== right.type) throw new TypeCheckError(`${op ?? 'EQ'}: 両辺の型が一致していません（左辺: ${typeLabel(left)}、右辺: ${typeLabel(right)}）`)
      return { type: 'b', expr: { kind: 'EQ', left, right } }
    }
    case 'SUM':
      return { type: 'n', expr: { kind: 'SUM',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), columns)) } }
    case 'MULT':
      return { type: 'n', expr: { kind: 'MULT', args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), columns)) } }
    case 'MIN':
      return { type: 'n', expr: { kind: 'MIN',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), columns)) } }
    case 'MAX':
      return { type: 'n', expr: { kind: 'MAX',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), columns)) } }
    case 'NEG':
      arity(1)
      return { type: 'n', expr: { kind: 'NEG',   arg: requireNum(args[0], at(0), columns) } }
    case 'INV':
      arity(1)
      return { type: 'n', expr: { kind: 'INV',   arg: requireNum(args[0], at(0), columns) } }
    case 'ROUND':
      arity(2)
      return { type: 'n', expr: { kind: 'ROUND', arg: requireNum(args[0], at(0), columns), digits: requireNum(args[1], at(1), columns) } }
    case 'SUBSTR': {
      arity(2)
      const str = requireStr(args[0], at(0), columns)
      const len = requireNum(args[1], at(1), columns)
      return { type: 's', expr: { kind: 'SUBSTR', str, len } }
    }
    case 'IF': {
      arity(3)
      const cond  = requireBool(args[0], at(0), columns)
      const then_ = typeCheck(args[1], columns)
      const else_ = typeCheck(args[2], columns)
      if (then_.type !== else_.type)
        throw new TypeCheckError(`IF: 第2・第3引数の型が一致していません（真の場合: ${typeLabel(then_)}、偽の場合: ${typeLabel(else_)}）`)
      if (then_.type === 'n' && else_.type === 'n')
        return { type: 'n', expr: { kind: 'IF', cond, then: then_.expr, else_: else_.expr } }
      if (then_.type === 'b' && else_.type === 'b')
        return { type: 'b', expr: { kind: 'IF', cond, then: then_.expr, else_: else_.expr } }
      if (then_.type === 's' && else_.type === 's')
        return { type: 's', expr: { kind: 'IF', cond, then: then_.expr, else_: else_.expr } }
      throw new TypeCheckError('IF: 型エラー')
    }
    default:
      throw new TypeCheckError(`「${name}」という関数名はありません`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseAndTypeCheck(input: string, columns?: ColumnTypeInfo[]): TypedExpr {
  const tokens = tokenize(input.trim())
  const raw = new Parser(tokens).parse()
  return typeCheck(raw, columns)
}

// Walks the already-typed AST looking for an `@id` node — used to warn
// before deleting a column that a filter/sort expression depends on.
// Deliberately walks the parsed tree rather than searching the source text,
// since a string literal argument could coincidentally contain "@3".
function numReferencesColumn(expr: NumExpr, id: number): boolean {
  switch (expr.kind) {
    case 'literal': case 'numvar': return false
    case 'SUM': case 'MULT': case 'MIN': case 'MAX': return expr.args.some(a => numReferencesColumn(a, id))
    case 'NEG': case 'INV': return numReferencesColumn(expr.arg, id)
    case 'ROUND': return numReferencesColumn(expr.arg, id) || numReferencesColumn(expr.digits, id)
    case 'IF': return boolReferencesColumn(expr.cond, id) || numReferencesColumn(expr.then, id) || numReferencesColumn(expr.else_, id)
    case 'colref': return expr.id === id
  }
}

function boolReferencesColumn(expr: BoolExpr, id: number): boolean {
  switch (expr.kind) {
    case 'AND': case 'OR': return expr.args.some(a => boolReferencesColumn(a, id))
    case 'NOT': return boolReferencesColumn(expr.arg, id)
    case 'LEQ': return numReferencesColumn(expr.left, id) || numReferencesColumn(expr.right, id)
    case 'EQ': return referencesColumn(expr.left, id) || referencesColumn(expr.right, id)
    case 'boolvar': return false
    case 'IF': return boolReferencesColumn(expr.cond, id) || boolReferencesColumn(expr.then, id) || boolReferencesColumn(expr.else_, id)
    case 'colref': return expr.id === id
  }
}

function strReferencesColumn(expr: StrExpr, id: number): boolean {
  switch (expr.kind) {
    case 'strlit': case 'strvar': return false
    case 'SUBSTR': return strReferencesColumn(expr.str, id) || numReferencesColumn(expr.len, id)
    case 'IF': return boolReferencesColumn(expr.cond, id) || strReferencesColumn(expr.then, id) || strReferencesColumn(expr.else_, id)
    case 'colref': return expr.id === id
  }
}

export function referencesColumn(expr: TypedExpr, id: number): boolean {
  switch (expr.type) {
    case 'n': return numReferencesColumn(expr.expr, id)
    case 'b': return boolReferencesColumn(expr.expr, id)
    case 's': return strReferencesColumn(expr.expr, id)
  }
}
