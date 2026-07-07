import { useState, useRef, useEffect, forwardRef } from 'react'
import { parseAndTypeCheck, ParseError, TypeCheckError, type TypedExpr, type ColumnTypeInfo } from '../lang/expr'
import ExprInput, { type ExprInputHandle } from './ExprInput'

type LiveResult =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; type: 'n' | 'b' | 's' }
  | { status: 'error'; message: string }

type Props = {
  initialExpression?: string
  placeholder?: string
  requiredType?: 'n' | 'b' | 's'
  // Only passed where `@id` column references are meaningful (filter/sort
  // editors) — omitting it (as ColumnModal does) keeps them rejected there.
  columns?: ColumnTypeInfo[]
  onValidExpr?: (expr: TypedExpr | null) => void
  onExpressionChange?: (raw: string) => void
}

const typeNames: Record<'n' | 'b' | 's', string> = { n: '数値', b: '真偽値', s: '文字列' }

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

const ExprEditor = forwardRef<ExprInputHandle, Props>(function ExprEditor(
  { initialExpression = '', placeholder, requiredType, columns, onValidExpr, onExpressionChange }, ref
) {
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
      const typed = parseAndTypeCheck(raw, columns)
      if (requiredType !== undefined && typed.type !== requiredType) {
        setResult({ status: 'error', message: `${typeNames[typed.type]}の式です（ここでは${typeNames[requiredType]}の式が必要です）` })
        onValidExpr?.(null)
        return
      }
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
      <ExprInput
        ref={ref}
        initialExpression={initialExpression}
        placeholder={placeholder ?? 'SUM(#female, NEG(#male))'}
        onChange={raw => { onExpressionChange?.(raw); runCheck(raw) }}
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
    </div>
  )
})

export default ExprEditor
