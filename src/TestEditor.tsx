import { useState } from 'react'
import { parseAndTypeCheck, ParseError, TypeCheckError } from './testExpr'

type CheckResult =
  | { status: 'idle' }
  | { status: 'ok'; type: 'n' | 'b' }
  | { status: 'error'; message: string }

function TestEditor() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<CheckResult>({ status: 'idle' })

  const handleCheck = () => {
    if (!input.trim()) {
      setResult({ status: 'error', message: 'Input is empty' })
      return
    }
    try {
      const typed = parseAndTypeCheck(input)
      setResult({ status: 'ok', type: typed.type })
    } catch (e) {
      const label = e instanceof ParseError ? 'Parse error' : e instanceof TypeCheckError ? 'Type error' : 'Error'
      setResult({ status: 'error', message: `${label}: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded">
      <h2 className="text-lg font-bold mb-3">式エディタ (Test)</h2>
      <textarea
        className="border border-gray-300 p-2 w-full font-mono text-sm rounded"
        rows={3}
        value={input}
        onChange={e => { setInput(e.target.value); setResult({ status: 'idle' }) }}
        placeholder="e.g.  AND(LEQ(1, 2), NOT(LEQ(SUM(3, NEG(1)), 0)))"
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
            ✓ {result.type === 'n' ? 'n  (number)' : 'b  (boolean)'}
          </span>
        )}
        {result.status === 'error' && (
          <span className="text-red-600 text-sm">{result.message}</span>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 font-mono leading-relaxed">
        AND(b…):b · OR(b…):b · NOT(b):b · LEQ(n,n):b · SUM(n…):n · NEG(n):n · INV(n):n · literal n
      </p>
    </div>
  )
}

export default TestEditor
