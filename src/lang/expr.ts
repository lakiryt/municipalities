// ── Raw parse tree (untyped) ──────────────────────────────────────────────────

type RawCall    = { kind: 'call';    name: string; args: RawExpr[] }
type RawLiteral = { kind: 'literal'; value: number }
type RawVar     = { kind: 'numvar';     name: string }
type RawStrLit  = { kind: 'strlit';  value: string }
type RawStrVar  = { kind: 'strvar';  name: string }
type RawBoolVar = { kind: 'boolvar'; name: string }
type RawExpr    = RawCall | RawLiteral | RawVar | RawStrLit | RawStrVar | RawBoolVar

// ── Typed AST ─────────────────────────────────────────────────────────────────

export type NumLiteral = { kind: 'literal'; value: number }
export type NumVar     = { kind: 'numvar';     name: string }
export type NumSum     = { kind: 'SUM';  args: NumExpr[] }
export type NumMult    = { kind: 'MULT'; args: NumExpr[] }
export type NumNeg     = { kind: 'NEG';   arg: NumExpr }
export type NumInv     = { kind: 'INV';   arg: NumExpr }
export type NumRound   = { kind: 'ROUND'; arg: NumExpr; digits: NumExpr }
export type NumExpr    = NumLiteral | NumVar | NumSum | NumMult | NumNeg | NumInv | NumRound

export type BoolAnd  = { kind: 'AND'; args: BoolExpr[] }
export type BoolOr   = { kind: 'OR';  args: BoolExpr[] }
export type BoolNot  = { kind: 'NOT'; arg: BoolExpr }
export type BoolLeq  = { kind: 'LEQ'; left: NumExpr; right: NumExpr }
export type BoolEq   = { kind: 'EQ';  left: TypedExpr; right: TypedExpr }
export type BoolVar  = { kind: 'boolvar'; name: string }
export type BoolExpr = BoolAnd | BoolOr | BoolNot | BoolLeq | BoolEq | BoolVar

export type StrLiteral = { kind: 'strlit';  value: string }
export type StrVar     = { kind: 'strvar';  name: string }
export type StrSubstr  = { kind: 'SUBSTR';  str: StrExpr; len: NumExpr }
export type StrExpr    = StrLiteral | StrVar | StrSubstr

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
type TokLParen  = { kind: 'lparen' }
type TokRParen  = { kind: 'rparen' }
type TokComma   = { kind: 'comma' }
type TokEof     = { kind: 'eof' }
type Token = TokIdent | TokNumber | TokVar | TokStrLit | TokStrVar | TokBoolVar | TokLParen | TokRParen | TokComma | TokEof

const japaneseDescriptions: Record<Token['kind'], string> = {
  ident:   '識別子',
  number:  '数値',
  numvar:  '数値変数',
  strlit:  '文字列リテラル',
  strvar:  '文字列変数',
  boolvar: '真偽値変数',
  lparen:  '左括弧',
  rparen:  '右括弧',
  comma:   'カンマ',
  eof:     '式の終わり',
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

    if (ch === '#') {
      let j = i + 1
      while (j < input.length && /[a-z_]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「#」の後には小文字のアルファベットまたはアンダースコアが必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'numvar', name: input.slice(i + 1, j) })
      i = j
      continue
    }

    if (ch === '$') {
      let j = i + 1
      while (j < input.length && /[a-z_]/.test(input[j])) j++
      if (j === i + 1) throw new ParseError(`「$」の後には小文字のアルファベットまたはアンダースコアが必要です（${i + 1}文字目）`)
      tokens.push({ kind: 'strvar', name: input.slice(i + 1, j) })
      i = j
      continue
    }

    if (ch === '&') {
      let j = i + 1
      while (j < input.length && /[a-z_]/.test(input[j])) j++
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

    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue }
    if (ch === ',') { tokens.push({ kind: 'comma'  }); i++; continue }

    throw new ParseError(`式に使用できない文字「${ch}」が用いられています（${i + 1}文字目）`)
  }

  tokens.push({ kind: 'eof' })
  return tokens
}

// ── Recursive descent parser ──────────────────────────────────────────────────

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
    if (tok.kind !== kind) throw new ParseError(`〈${japaneseDescriptions[kind]}〉が来るべきところ〈${japaneseDescriptions[tok.kind]}〉でした`)
    return tok
  }

  parseExpr(): RawExpr {
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
        throw new ParseError(`${tok.value}(...)を閉じる〈右括弧〉がないまま〈${japaneseDescriptions[closing.kind]}〉となりました`)
      this.consume()
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

const typeLabel = (t: TypedExpr): string =>
  t.type === 'n' ? '数値' : t.type === 'b' ? '真偽値' : '文字列'

function requireNum(raw: RawExpr, context: string): NumExpr {
  const t = typeCheck(raw)
  if (t.type !== 'n') throw new TypeCheckError(`${context}: 数値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireBool(raw: RawExpr, context: string): BoolExpr {
  const t = typeCheck(raw)
  if (t.type !== 'b') throw new TypeCheckError(`${context}: 真偽値であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function requireStr(raw: RawExpr, context: string): StrExpr {
  const t = typeCheck(raw)
  if (t.type !== 's') throw new TypeCheckError(`${context}: 文字列であるべきところ、${typeLabel(t)}になっています`)
  return t.expr
}

function typeCheck(raw: RawExpr): TypedExpr {
  if (raw.kind === 'literal') {
    return { type: 'n', expr: { kind: 'literal', value: raw.value } }
  }

  if (raw.kind === 'numvar') {
    return { type: 'n', expr: { kind: 'numvar', name: raw.name } }
  }

  if (raw.kind === 'strlit') {
    return { type: 's', expr: { kind: 'strlit', value: raw.value } }
  }

  if (raw.kind === 'strvar') {
    return { type: 's', expr: { kind: 'strvar', name: raw.name } }
  }

  if (raw.kind === 'boolvar') {
    return { type: 'b', expr: { kind: 'boolvar', name: raw.name } }
  }

  const { name, args } = raw

  const arity = (n: number) => {
    if (args.length !== n)
      throw new TypeCheckError(`${name}が受けつける引数は${n}個ですが、${args.length}個与えられました`)
  }

  switch (name) {
    case 'AND':
      return { type: 'b', expr: { kind: 'AND', args: args.map((a: RawExpr, i: number) => requireBool(a, `ANDの${i + 1}番目の引数`)) } }
    case 'OR':
      return { type: 'b', expr: { kind: 'OR',  args: args.map((a: RawExpr, i: number) => requireBool(a, `ORの${i + 1}番目の引数`)) } }
    case 'NOT':
      arity(1)
      return { type: 'b', expr: { kind: 'NOT', arg: requireBool(args[0], 'NOTの1番目の引数') } }
    case 'LEQ':
      arity(2)
      return { type: 'b', expr: { kind: 'LEQ', left: requireNum(args[0], 'LEQの1番目の引数'), right: requireNum(args[1], 'LEQの2番目の引数') } }
    case 'EQ': {
      arity(2)
      const left = typeCheck(args[0])
      const right = typeCheck(args[1])
      if (left.type !== right.type) throw new TypeCheckError(`EQ: 両辺の型が一致していません（左辺: ${typeLabel(left)}、右辺: ${typeLabel(right)}）`)
      return { type: 'b', expr: { kind: 'EQ', left, right } }
    }
    case 'SUM':
      return { type: 'n', expr: { kind: 'SUM',  args: args.map((a: RawExpr, i: number) => requireNum(a, `SUMの${i + 1}番目の引数`)) } }
    case 'MULT':
      return { type: 'n', expr: { kind: 'MULT', args: args.map((a: RawExpr, i: number) => requireNum(a, `MULTの${i + 1}番目の引数`)) } }
    case 'NEG':
      arity(1)
      return { type: 'n', expr: { kind: 'NEG',   arg: requireNum(args[0], 'NEGの1番目の引数') } }
    case 'INV':
      arity(1)
      return { type: 'n', expr: { kind: 'INV',   arg: requireNum(args[0], 'INVの1番目の引数') } }
    case 'ROUND':
      arity(2)
      return { type: 'n', expr: { kind: 'ROUND', arg: requireNum(args[0], 'ROUNDの1番目の引数'), digits: requireNum(args[1], 'ROUNDの2番目の引数') } }
    case 'SUBSTR': {
      arity(2)
      const str = requireStr(args[0], 'SUBSTRの1番目の引数')
      const len = requireNum(args[1], 'SUBSTRの2番目の引数')
      return { type: 's', expr: { kind: 'SUBSTR', str, len } }
    }
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
