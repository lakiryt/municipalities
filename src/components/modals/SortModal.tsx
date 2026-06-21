import { useState } from 'react'
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import ExprEditor from '@/components/ExprEditor'

type Props = {
  initialExpression: string
  initialDirection: 'asc' | 'desc'
  onApply: (expression: string, typed: TypedExpr, direction: 'asc' | 'desc') => void
  onClear: () => void
  onClose: () => void
}

function SortModal({ initialExpression, initialDirection, onApply, onClear, onClose }: Props) {
  const [expression, setExpression] = useState(initialExpression)
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection)
  const [validExpr, setValidExpr] = useState<TypedExpr | null>(() => {
    if (!initialExpression.trim()) return null
    try {
      const t = parseAndTypeCheck(initialExpression)
      return t.type === 'n' ? t : null
    } catch { return null }
  })

  const btnBase = 'px-3 py-1 border rounded text-sm'
  const btnActive = 'bg-blue-600 text-white border-blue-600'
  const btnInactive = 'border-gray-300 hover:bg-gray-50'

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[520px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">並べ替え</h3>

        <ExprEditor
          initialExpression={initialExpression}
          requiredType="n"
          onValidExpr={setValidExpr}
          onExpressionChange={setExpression}
        />

        <div className="flex gap-2 mt-4">
          <button
            className={`${btnBase} ${direction === 'asc' ? btnActive : btnInactive}`}
            onClick={() => setDirection('asc')}
          >
            ↑ 昇順
          </button>
          <button
            className={`${btnBase} ${direction === 'desc' ? btnActive : btnInactive}`}
            onClick={() => setDirection('desc')}
          >
            ↓ 降順
          </button>
        </div>

        <div className="flex justify-between mt-5">
          <button
            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!initialExpression}
            onClick={onClear}
          >
            クリア
          </button>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!validExpr}
              onClick={() => { if (validExpr) onApply(expression, validExpr, direction) }}
            >
              適用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SortModal
