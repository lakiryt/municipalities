import { isNumVar, isStrVar, isBoolVar, type NumVarName, type StrVarName, type BoolVarName } from './variables'
import { asFinite, type Finite } from './value'
// ── Raw parse tree (untyped) ──────────────────────────────────────────────────

// `op` is set when the call was written as an operator (`a + b` is SUM(a, b)):
// it names what the user wrote, for error messages.
type RawCall    = { kind: 'call';    name: string; args: RawExpr[]; op?: string }
type RawLiteral = { kind: 'literal'; value: Finite }
type RawVar     = { kind: 'numvar';     name: string }
type RawStrLit  = { kind: 'strlit';  value: string }
type RawStrVar  = { kind: 'strvar';  name: string }
type RawBoolVar = { kind: 'boolvar'; name: string }
type RawColRef  = { kind: 'colref'; id: number }
type RawExpr    = RawCall | RawLiteral | RawVar | RawStrLit | RawStrVar | RawBoolVar | RawColRef

// ── Typed AST ─────────────────────────────────────────────────────────────────

// `S` is which `@id` column references can occur, per type. A column's own
// expression is Closed (none): it can't refer to a column, so references
// never form a cycle. Filter, sort and map expressions are Open. A reference
// carries the referenced column's (closed) typed expression itself, so
// evaluating it looks nothing up — there is nothing to dangle or go stale.
// (Closed's `never`s make a closed expression an open one as well.)
export type Open = { n: NumColRef; b: BoolColRef; s: StrColRef }
export type Closed = { n: never; b: never; s: never }

export type NumLiteral = { kind: 'literal'; value: Finite }
export type NumVar     = { kind: 'numvar';  name: NumVarName }
export type NumSum<S extends Open = Open>   = { kind: 'SUM';  args: NumExpr<S>[] }
export type NumMult<S extends Open = Open>  = { kind: 'MULT'; args: NumExpr<S>[] }
export type NumMin<S extends Open = Open>   = { kind: 'MIN';  args: NumExpr<S>[] }
export type NumMax<S extends Open = Open>   = { kind: 'MAX';  args: NumExpr<S>[] }
export type NumNeg<S extends Open = Open>   = { kind: 'NEG';  arg: NumExpr<S> }
export type NumInv<S extends Open = Open>   = { kind: 'INV';  arg: NumExpr<S> }
// `digits` is written as an integer literal within ±ROUND_DIGITS: a number
// has about 15 significant decimal digits, and past them rounding means
// nothing (or overflows) — so other digits are a type error, not a NaN.
export const ROUND_DIGITS = 15
export type NumRound<S extends Open = Open> = { kind: 'ROUND'; arg: NumExpr<S>; digits: number }
export type NumIf<S extends Open = Open>    = { kind: 'IF'; cond: BoolExpr<S>; then: NumExpr<S>; else_: NumExpr<S> }
export type NumColRef  = { kind: 'colref'; id: number; target: NumExpr<Closed> }
export type NumExpr<S extends Open = Open> =
  | NumLiteral | NumVar | NumSum<S> | NumMult<S> | NumMin<S> | NumMax<S> | NumNeg<S> | NumInv<S> | NumRound<S> | NumIf<S>
  | S['n']

export type BoolAnd<S extends Open = Open> = { kind: 'AND'; args: BoolExpr<S>[] }
export type BoolOr<S extends Open = Open>  = { kind: 'OR';  args: BoolExpr<S>[] }
export type BoolNot<S extends Open = Open> = { kind: 'NOT'; arg: BoolExpr<S> }
export type BoolLeq<S extends Open = Open> = { kind: 'LEQ'; left: NumExpr<S>; right: NumExpr<S> }
export type BoolEq<S extends Open = Open>  = { kind: 'EQ';  left: TypedExpr<S>; right: TypedExpr<S> }
export type BoolVar  = { kind: 'boolvar'; name: BoolVarName }
export type BoolIf<S extends Open = Open>  = { kind: 'IF'; cond: BoolExpr<S>; then: BoolExpr<S>; else_: BoolExpr<S> }
export type BoolColRef = { kind: 'colref'; id: number; target: BoolExpr<Closed> }
export type BoolExpr<S extends Open = Open> =
  | BoolAnd<S> | BoolOr<S> | BoolNot<S> | BoolLeq<S> | BoolEq<S> | BoolVar | BoolIf<S>
  | S['b']

export type StrLiteral = { kind: 'strlit'; value: string }
export type StrVar     = { kind: 'strvar'; name: StrVarName }
export type StrSubstr<S extends Open = Open> = { kind: 'SUBSTR'; str: StrExpr<S>; len: NumExpr<S> }
export type StrIf<S extends Open = Open>     = { kind: 'IF'; cond: BoolExpr<S>; then: StrExpr<S>; else_: StrExpr<S> }
export type StrColRef  = { kind: 'colref'; id: number; target: StrExpr<Closed> }
export type StrExpr<S extends Open = Open> = StrLiteral | StrVar | StrSubstr<S> | StrIf<S> | S['s']

export type TypedNum<S extends Open = Open>  = { type: 'n'; expr: NumExpr<S> }
export type TypedBool<S extends Open = Open> = { type: 'b'; expr: BoolExpr<S> }
export type TypedStr<S extends Open = Open>  = { type: 's'; expr: StrExpr<S> }
export type TypedExpr<S extends Open = Open> = TypedNum<S> | TypedBool<S> | TypedStr<S>

/** A column `@id` can refer to: its id and its own (closed) typed expression. */
export type ColumnInfo = { id: number; typed: TypedExpr<Closed> }

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type TokIdent   = { kind: 'ident';   value: string }
type TokNumber  = { kind: 'number';  value: Finite }
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

type SymbolOp = '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '<=' | '>' | '>='
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
      const value = asFinite(Number(input.slice(i, j)))
      if (value === undefined) throw new ParseError(`数値が大きすぎます（${i + 1}文字目）`)
      tokens.push({ kind: 'number', value })
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
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '=' || ch === '<' || ch === '>') { tokens.push({ kind: 'op', value: ch }); i++; continue }

    throw new ParseError(`式に使用できない文字「${ch}」が用いられています（${i + 1}文字目）`)
  }

  tokens.push({ kind: 'eof' })
  return tokens
}

// ── Parser (recursive descent, operators by binding power) ──────────────────

// Operators are notation for the core functions: `a - b` is SUM(a, NEG(b)),
// `a / b` is MULT(a, INV(b)), `a < b` is NOT(LEQ(b, a)) — the same as a
// comparison of its own, since a comparison with a missing side is missing
// and so is its NOT (lang/value.ts). The typed AST and the
// evaluator know nothing of them. A higher binding power binds tighter;
// comparisons don't associate (`a <= b <= c` is an error, not a guess).
const INFIX: Record<InfixOp, { bp: number; assoc: 'left' | 'none' }> = {
  'OR':  { bp: 1, assoc: 'left' },
  'AND': { bp: 2, assoc: 'left' },
  '=':   { bp: 3, assoc: 'none' },
  '!=':  { bp: 3, assoc: 'none' },
  '<':   { bp: 3, assoc: 'none' },
  '<=':  { bp: 3, assoc: 'none' },
  '>':   { bp: 3, assoc: 'none' },
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
    case '<':   return call('NOT', [call('LEQ', [right, left], '「<」')], '「<」')
    case '<=':  return call('LEQ', [left, right], '「<=」')
    case '>':   return call('NOT', [call('LEQ', [left, right], '「>」')], '「>」')
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
        ? { kind: 'literal', value: -operand.value as Finite }
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

const typeLabel = <S extends Open>(t: TypedExpr<S>): string =>
  t.type === 'n' ? '数値' : t.type === 'b' ? '真偽値' : '文字列'

function requireNum<S extends Open>(raw: RawExpr, context: string, ref: RefResolver<S>): NumExpr<S> {
  const t = typeCheck(raw, ref)
  if (t.type !== 'n') throw new TypeCheckError(`${context}: 数値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireBool<S extends Open>(raw: RawExpr, context: string, ref: RefResolver<S>): BoolExpr<S> {
  const t = typeCheck(raw, ref)
  if (t.type !== 'b') throw new TypeCheckError(`${context}: 真偽値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireStr<S extends Open>(raw: RawExpr, context: string, ref: RefResolver<S>): StrExpr<S> {
  const t = typeCheck(raw, ref)
  if (t.type !== 's') throw new TypeCheckError(`${context}: 文字列であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

// How `@id` is typed: for a closed expression it is an error; for an open one
// it becomes a reference carrying the column's expression.
type RefResolver<S extends Open> = (id: number) => TypedExpr<S>

const noRefs: RefResolver<Closed> = () => {
  throw new TypeCheckError('「@」列参照はフィルター・並べ替えの式でのみ使用できます')
}

const refsTo = (columns: readonly ColumnInfo[]): RefResolver<Open> => id => {
  const col = columns.find(c => c.id === id)
  if (!col) throw new TypeCheckError(`列ID「@${id}」に対応する列が見つかりません`)
  const t = col.typed
  switch (t.type) {
    case 'n': return { type: 'n', expr: { kind: 'colref', id, target: t.expr } }
    case 'b': return { type: 'b', expr: { kind: 'colref', id, target: t.expr } }
    case 's': return { type: 's', expr: { kind: 'colref', id, target: t.expr } }
  }
}

function typeCheck<S extends Open>(raw: RawExpr, ref: RefResolver<S>): TypedExpr<S> {
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

  if (raw.kind === 'colref') return ref(raw.id)

  const { name, args, op } = raw
  // What an error points at: the operator as written, or the function's argument.
  const at = (i: number) => op ? `${op}の項` : `${name}の${i + 1}番目の引数`

  const atLeastOne = () => {
    if (args.length === 0) throw new TypeCheckError(`${name}には引数が1つ以上必要です`)
  }

  const arity = (n: number) => {
    if (args.length !== n)
      throw new TypeCheckError(`${name}が受けつける引数は${n}個ですが、${args.length}個与えられました`)
  }

  switch (name) {
    case 'AND':
      return { type: 'b', expr: { kind: 'AND', args: args.map((a: RawExpr, i: number) => requireBool(a, at(i), ref)) } }
    case 'OR':
      return { type: 'b', expr: { kind: 'OR',  args: args.map((a: RawExpr, i: number) => requireBool(a, at(i), ref)) } }
    case 'NOT':
      arity(1)
      return { type: 'b', expr: { kind: 'NOT', arg: requireBool(args[0], at(0), ref) } }
    case 'LEQ':
      arity(2)
      return { type: 'b', expr: { kind: 'LEQ', left: requireNum(args[0], at(0), ref), right: requireNum(args[1], at(1), ref) } }
    case 'EQ': {
      arity(2)
      const left = typeCheck(args[0], ref)
      const right = typeCheck(args[1], ref)
      if (left.type !== right.type) throw new TypeCheckError(`${op ?? 'EQ'}: 両辺の型が一致していません（左辺: ${typeLabel(left)}、右辺: ${typeLabel(right)}）`)
      return { type: 'b', expr: { kind: 'EQ', left, right } }
    }
    case 'SUM':
      return { type: 'n', expr: { kind: 'SUM',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), ref)) } }
    case 'MULT':
      return { type: 'n', expr: { kind: 'MULT', args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), ref)) } }
    case 'MIN':
      atLeastOne()
      return { type: 'n', expr: { kind: 'MIN',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), ref)) } }
    case 'MAX':
      atLeastOne()
      return { type: 'n', expr: { kind: 'MAX',  args: args.map((a: RawExpr, i: number) => requireNum(a, at(i), ref)) } }
    case 'NEG':
      arity(1)
      return { type: 'n', expr: { kind: 'NEG',   arg: requireNum(args[0], at(0), ref) } }
    case 'INV':
      arity(1)
      return { type: 'n', expr: { kind: 'INV',   arg: requireNum(args[0], at(0), ref) } }
    case 'ROUND': {
      arity(2)
      const arg = requireNum(args[0], at(0), ref)
      const d = args[1]
      if (d.kind !== 'literal' || !Number.isInteger(d.value) || Math.abs(d.value) > ROUND_DIGITS)
        throw new TypeCheckError(`${at(1)}: 桁数は -${ROUND_DIGITS}〜${ROUND_DIGITS} の整数で書いてください`)
      return { type: 'n', expr: { kind: 'ROUND', arg, digits: d.value } }
    }
    case 'SUBSTR': {
      arity(2)
      const str = requireStr(args[0], at(0), ref)
      const len = requireNum(args[1], at(1), ref)
      return { type: 's', expr: { kind: 'SUBSTR', str, len } }
    }
    case 'IF': {
      arity(3)
      const cond  = requireBool(args[0], at(0), ref)
      const then_ = typeCheck(args[1], ref)
      const else_ = typeCheck(args[2], ref)
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

// Without columns, `@id` is an error and the result is closed (a column's own
// expression); with them, `@id` refers to one of those columns.
export function parseAndTypeCheck(input: string): TypedExpr<Closed>
export function parseAndTypeCheck(input: string, columns: readonly ColumnInfo[] | undefined): TypedExpr
export function parseAndTypeCheck(input: string, columns?: readonly ColumnInfo[]): TypedExpr {
  const tokens = tokenize(input.trim())
  const raw = new Parser(tokens).parse()
  return columns ? typeCheck(raw, refsTo(columns)) : typeCheck(raw, noRefs)
}

// ── Walking a typed expression ────────────────────────────────────────────────

const num = (expr: NumExpr): TypedExpr => ({ type: 'n', expr })
const bool = (expr: BoolExpr): TypedExpr => ({ type: 'b', expr })
const str = (expr: StrExpr): TypedExpr => ({ type: 's', expr })

/** The sub-expressions directly under `t` (a reference: its column's expression). */
function children(t: TypedExpr): TypedExpr[] {
  switch (t.type) {
    case 'n': {
      const e = t.expr
      switch (e.kind) {
        case 'literal': case 'numvar': return []
        case 'SUM': case 'MULT': case 'MIN': case 'MAX': return e.args.map(num)
        case 'NEG': case 'INV': case 'ROUND': return [num(e.arg)]
        case 'IF': return [bool(e.cond), num(e.then), num(e.else_)]
        case 'colref': return [num(e.target)]
      }
      break
    }
    case 'b': {
      const e = t.expr
      switch (e.kind) {
        case 'boolvar': return []
        case 'AND': case 'OR': return e.args.map(bool)
        case 'NOT': return [bool(e.arg)]
        case 'LEQ': return [num(e.left), num(e.right)]
        case 'EQ': return [e.left, e.right]
        case 'IF': return [bool(e.cond), bool(e.then), bool(e.else_)]
        case 'colref': return [bool(e.target)]
      }
      break
    }
    case 's': {
      const e = t.expr
      switch (e.kind) {
        case 'strlit': case 'strvar': return []
        case 'SUBSTR': return [str(e.str), num(e.len)]
        case 'IF': return [bool(e.cond), str(e.then), str(e.else_)]
        case 'colref': return [str(e.target)]
      }
    }
  }
}

/** `t` and every expression within it. */
export function* walk(t: TypedExpr): Generator<TypedExpr> {
  yield t
  for (const c of children(t)) yield* walk(c)
}

/**
 * Whether `t` refers to column `id` — to warn before deleting a column a
 * filter or sort depends on. (The tree, not the text: a string literal
 * could contain "@3".)
 */
export const referencesColumn = (t: TypedExpr, id: number): boolean =>
  [...walk(t)].some(x => x.expr.kind === 'colref' && x.expr.id === id)

/** The variables `t` reads (through any column it refers to as well). */
export function variablesOf(t: TypedExpr) {
  const vars = { num: new Set<NumVarName>(), str: new Set<StrVarName>(), bool: new Set<BoolVarName>() }
  for (const x of walk(t)) {
    if (x.type === 'n' && x.expr.kind === 'numvar') vars.num.add(x.expr.name)
    if (x.type === 's' && x.expr.kind === 'strvar') vars.str.add(x.expr.name)
    if (x.type === 'b' && x.expr.kind === 'boolvar') vars.bool.add(x.expr.name)
  }
  return vars
}
