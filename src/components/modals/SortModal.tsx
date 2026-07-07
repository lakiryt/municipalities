import { useState, useRef } from 'react'
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import type { ColumnRef } from '@/types'
import ExprEditor from '@/components/ExprEditor'
import { type ExprInputHandle } from '@/components/ExprInput'
import ColumnRefChips from '@/components/ColumnRefChips'

type Props = {
  initialExpression: string
  initialDirection: 'asc' | 'desc'
  columns?: ColumnRef[]
  onApply: (expression: string, typed: TypedExpr, direction: 'asc' | 'desc') => void
  onClear: () => void
  onClose: () => void
}

function SortModal({ initialExpression, initialDirection, columns = [], onApply, onClear, onClose }: Props) {
  const [expression, setExpression] = useState(initialExpression)
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection)
  const [validExpr, setValidExpr] = useState<TypedExpr | null>(() => {
    if (!initialExpression.trim()) return null
    try { const t = parseAndTypeCheck(initialExpression, columns); return (['n', 's'] as string[]).includes(t.type) ? t : null } catch { return null }
  })
  const editorRef = useRef<ExprInputHandle>(null)

  const btnBase     = 'flex-1 py-1 text-sm rounded border'
  const btnActive   = 'bg-blue-600 text-white border-blue-600'
  const btnInactive = 'border-gray-300 hover:bg-gray-50'

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[520px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">並べ替え</h3>

        <ExprEditor
          ref={editorRef}
          initialExpression={initialExpression}
          placeholder='ROUND(MULT(#totalpop, INV(#area)), 2)'
          columns={columns}
          onValidExpr={e => setValidExpr(e && (['n', 's'] as string[]).includes(e.type) ? e : null)}
          onExpressionChange={setExpression}
        />
        <ColumnRefChips columns={columns} onInsert={text => editorRef.current?.insertAtCursor(text)} />

        <div className="flex gap-1 mt-4">
          {(['desc', 'asc'] as const).map(dir => (
            <button
              key={dir}
              onClick={() => setDirection(dir)}
              className={`${btnBase} ${direction === dir ? btnActive : btnInactive}`}
            >
              {dir === 'desc' ? '↓ 降順' : '↑ 昇順'}
            </button>
          ))}
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
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
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
