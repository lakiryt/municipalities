// ── Raw parse tree (untyped) ──────────────────────────────────────────────────

type RawCall = { kind: 'call'; name: string; args: RawExpr[] }
type RawLiteral = { kind: 'literal'; value: number }
type RawExpr = RawCall | RawLiteral

// ── Typed AST ─────────────────────────────────────────────────────────────────

export type NumLiteral = { kind: 'literal'; value: number }
export type NumSum     = { kind: 'SUM'; args: NumExpr[] }
export type NumNeg     = { kind: 'NEG'; arg: NumExpr }
export type NumInv     = { kind: 'INV'; arg: NumExpr }
export type NumExpr    = NumLiteral | NumSum | NumNeg | NumInv

export type BoolAnd  = { kind: 'AND'; args: BoolExpr[] }
export type BoolOr   = { kind: 'OR';  args: BoolExpr[] }
export type BoolNot  = { kind: 'NOT'; arg: BoolExpr }
export type BoolLeq  = { kind: 'LEQ'; left: NumExpr; right: NumExpr }
export type BoolExpr = BoolAnd | BoolOr | BoolNot | BoolLeq

export type TypedNum  = { type: 'n'; expr: NumExpr }
export type TypedBool = { type: 'b'; expr: BoolExpr }
export type TypedExpr = TypedNum | TypedBool

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type TokIdent  = { kind: 'ident';  value: string }
type TokNumber = { kind: 'number'; value: number }
type TokLParen = { kind: 'lparen' }
type TokRParen = { kind: 'rparen' }
type TokComma  = { kind: 'comma' }
type TokEof    = { kind: 'eof' }
type Token = TokIdent | TokNumber | TokLParen | TokRParen | TokComma | TokEof

const japaneseDescriptions: Record<Token['kind'], string> = {
  ident: '識別子',
  number: '数値',
  lparen: '左括弧',
  rparen: '右括弧',
  comma: 'カンマ',
  eof: '式の終わり'
}

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

    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue }
    if (ch === ',') { tokens.push({ kind: 'comma'  }); i++; continue }

    throw new ParseError(`式に使用できない文字「${ch}」が用いられています（${i+1}文字目）`)
  }

  tokens.push({ kind: 'eof' })
  return tokens
}

// ── Recursive descent parser ──────────────────────────────────────────────────

class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos] }

  private consume(): Token { return this.tokens[this.pos++] }

  private expect(kind: Token['kind']): Token {
    const tok = this.consume()
    if (tok.kind !== kind) throw new ParseError(`〈${japaneseDescriptions[kind]}〉であるべきところ〈${japaneseDescriptions[tok.kind]}〉でした`)
    return tok
  }

  parseExpr(): RawExpr {
    const tok = this.peek()

    if (tok.kind === 'number') {
      this.consume()
      return { kind: 'literal', value: tok.value }
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
      this.expect('rparen')
      return { kind: 'call', name: tok.value, args }
    }

    throw new ParseError(`〈${japaneseDescriptions[tok.kind]}〉が正しくない場所で使用されています`)
  }

  parse(): RawExpr {
    const expr = this.parseExpr()
    const remaining = this.peek()
    if (remaining.kind !== 'eof') {
      throw new ParseError(`式が終了しているにもかかわらず、後ろに〈${japaneseDescriptions[remaining.kind]}〉が続いています`)
    }
    return expr
  }
}

// ── Type checker ──────────────────────────────────────────────────────────────

function requireNum(raw: RawExpr, context: string): NumExpr {
  const t = typeCheck(raw)
  if (t.type !== 'n') throw new TypeCheckError(`${context}: 数値であるべきところ、真偽値になっています`)
  return t.expr
}

function requireBool(raw: RawExpr, context: string): BoolExpr {
  const t = typeCheck(raw)
  if (t.type !== 'b') throw new TypeCheckError(`${context}: 真偽値であるべきところ、数値になっています`)
  return t.expr
}

function typeCheck(raw: RawExpr): TypedExpr {
  if (raw.kind === 'literal') {
    return { type: 'n', expr: { kind: 'literal', value: raw.value } }
  }

  const { name, args } = raw

  const arity = (n: number) => {
    if (args.length !== n)
      throw new TypeCheckError(`${name}が受けつける引数は${n}個ですが、${args.length} 個与えられました`)
  }

  switch (name) {
    case 'AND':
      return { type: 'b', expr: { kind: 'AND', args: args.map((a, i) => requireBool(a, `ANDの${i + 1}番目の引数`)) } }
    case 'OR':
      return { type: 'b', expr: { kind: 'OR',  args: args.map((a, i) => requireBool(a, `ORの${i + 1}番目の引数`)) } }
    case 'NOT':
      arity(1)
      return { type: 'b', expr: { kind: 'NOT', arg: requireBool(args[0], 'NOTの1番目の引数') } }
    case 'LEQ':
      arity(2)
      return { type: 'b', expr: { kind: 'LEQ', left: requireNum(args[0], 'LEQの1番目の引数'), right: requireNum(args[1], 'LEQの2番目の引数') } }
    case 'SUM':
      return { type: 'n', expr: { kind: 'SUM', args: args.map((a, i) => requireNum(a, `SUMの${i + 1}番目の引数`)) } }
    case 'NEG':
      arity(1)
      return { type: 'n', expr: { kind: 'NEG', arg: requireNum(args[0], 'NEGの1番目の引数') } }
    case 'INV':
      arity(1)
      return { type: 'n', expr: { kind: 'INV', arg: requireNum(args[0], 'INVの1番目の引数') } }
    default:
      throw new TypeCheckError(`「${name}」という関数名はありません`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseAndTypeCheck(input: string): TypedExpr {
  const tokens = tokenize(input.trim())
  const raw = new Parser(tokens).parse()
  return typeCheck(raw)
}
