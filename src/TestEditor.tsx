import { useState } from 'react'
import { parseAndTypeCheck, ParseError, TypeCheckError, type TypedExpr } from './testExpr'

type CheckResult =
  | { status: 'idle' }
  | { status: 'ok'; type: 'n' | 'b' | 's' }
  | { status: 'error'; message: string }

type Props = {
  onValidExpr?: (expr: TypedExpr | null) => void
}

function TestEditor({ onValidExpr }: Props) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<CheckResult>({ status: 'idle' })

  const handleCheck = () => {
    if (!input.trim()) {
      setResult({ status: 'error', message: 'Input is empty' })
      onValidExpr?.(null)
      return
    }
    try {
      const typed = parseAndTypeCheck(input)
      setResult({ status: 'ok', type: typed.type })
      onValidExpr?.(typed)
    } catch (e) {
      const label = e instanceof ParseError ? 'Parse error' : e instanceof TypeCheckError ? 'Type error' : 'Error'
      setResult({ status: 'error', message: `${label}: ${e instanceof Error ? e.message : String(e)}` })
      onValidExpr?.(null)
    }
  }

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded">
      <h2 className="text-lg font-bold mb-3">式エディタ (Test)</h2>
      <textarea
        className="border border-gray-300 p-2 w-full font-mono text-sm rounded"
        rows={3}
        value={input}
        onChange={e => { setInput(e.target.value); setResult({ status: 'idle' }); onValidExpr?.(null) }}
        placeholder="e.g.  SUM(#female, NEG(#male))"
        spellCheck={false}
      />
      <div className="flex items-center gap-4 mt-2">
        <button
          className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          onClick={handleCheck}
        >
          Type check
        </button>
        {result.status === 'ok' && (
          <span className="text-green-700 text-sm font-mono">
            ✓ {result.type === 'n' ? 'n  (number)' : result.type === 'b' ? 'b  (boolean)' : 's  (string)'}
          </span>
        )}
        {result.status === 'error' && (
          <span className="text-red-600 text-sm">{result.message}</span>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 font-mono leading-relaxed">
        AND(b…):b · OR(b…):b · NOT(b):b · LEQ(n,n):b · EQ(a,a):b · SUM(n…):n · NEG(n):n · INV(n):n
        <br />
        #total · #male · #female · $code · $kanji · $kana · $prefcode · $prefkanji · $prefkana
      </p>
    </div>
  )
}

export default TestEditor
