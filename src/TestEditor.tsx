import { useState, useRef, useEffect } from 'react'
import { parseAndTypeCheck, ParseError, TypeCheckError, type TypedExpr } from './testExpr'

type LiveResult =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; type: 'n' | 'b' | 's' }
  | { status: 'error'; message: string }

type Props = {
  initialExpression?: string
  onValidExpr?: (expr: TypedExpr | null) => void
  onExpressionChange?: (raw: string) => void
}

function AnimatedDots() {
  return (
    <span className="inline-flex items-end gap-px" aria-hidden="true">
      {([0, -333, -666] as const).map((delay, i) => (
        <span
          key={i}
          className="inline-block animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        >.</span>
      ))}
    </span>
  )
}

const ERROR_DELAY_MS = 600

function TestEditor({ initialExpression = '', onValidExpr, onExpressionChange }: Props) {
  const [input, setInput] = useState(initialExpression)
  const [result, setResult] = useState<LiveResult>({ status: 'idle' })
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current) }, [])

  const runCheck = (raw: string) => {
    if (errorTimer.current) clearTimeout(errorTimer.current)

    if (!raw.trim()) {
      setResult({ status: 'idle' })
      onValidExpr?.(null)
      return
    }

    try {
      const typed = parseAndTypeCheck(raw)
      setResult({ status: 'ok', type: typed.type })
      onValidExpr?.(typed)
    } catch (e) {
      const prefix = e instanceof ParseError ? 'まだ構文に問題があるようです' : e instanceof TypeCheckError ? 'まだ型に問題があるようです' : 'エラーが発生しています'
      const message = `${prefix}：${e instanceof Error ? e.message : String(e)}`
      setResult({ status: 'pending' })
      onValidExpr?.(null)
      errorTimer.current = setTimeout(() => setResult({ status: 'error', message }), ERROR_DELAY_MS)
    }
  }

  return (
    <div>
      <textarea
        className="border border-gray-300 p-2 w-full font-mono text-sm rounded"
        rows={3}
        value={input}
        onChange={e => {
          const raw = e.target.value
          setInput(raw)
          onExpressionChange?.(raw)
          runCheck(raw)
        }}
        placeholder="e.g.  SUM(#female, NEG(#male))"
        spellCheck={false}
      />
      <div className="mt-1 min-h-[1.25rem] text-sm">
        {result.status === 'ok' && (
          <span className="text-green-700 font-mono">
            ✓ {result.type === 'n' ? '数値' : result.type === 'b' ? '真偽値' : '文字列'}の式として有効です
          </span>
        )}
        {result.status === 'pending' && (
          <span className="text-gray-400 font-mono"><AnimatedDots /></span>
        )}
        {result.status === 'error' && (
          <span className="text-gray-500">
            <AnimatedDots />{' '}{result.message}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400 font-mono leading-relaxed">
        AND(b…):b · OR(b…):b · NOT(b):b · LEQ(n,n):b · EQ(a,a):b · SUM(n…):n · MULT(n…):n · NEG(n):n · INV(n):n
        <br />
        #total · #male · #female · $code · $kanji · $kana · $prefcode · $prefkanji · $prefkana
      </p>
    </div>
  )
}

export default TestEditor
