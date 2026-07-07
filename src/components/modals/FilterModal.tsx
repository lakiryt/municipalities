import { useState, useRef } from 'react'
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import type { ColumnRef } from '@/types'
import ExprEditor from '@/components/ExprEditor'
import { type ExprInputHandle } from '@/components/ExprInput'
import ColumnRefChips from '@/components/ColumnRefChips'

type Props = {
  initialExpression: string
  columns?: ColumnRef[]
  onApply: (expression: string, typed: TypedExpr) => void
  onClear: () => void
  onClose: () => void
}

function FilterModal({ initialExpression, columns = [], onApply, onClear, onClose }: Props) {
  const [expression, setExpression] = useState(initialExpression)
  const [validExpr, setValidExpr] = useState<TypedExpr | null>(() => {
    if (!initialExpression.trim()) return null
    try { const t = parseAndTypeCheck(initialExpression, columns); return t.type === 'b' ? t : null } catch { return null }
  })
  const editorRef = useRef<ExprInputHandle>(null)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[520px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">絞り込み</h3>

        <ExprEditor
          ref={editorRef}
          initialExpression={initialExpression}
          placeholder='AND(EQ($prefkanji, "東京都"), LEQ(#totalpop, 100000))'
          requiredType="b"
          columns={columns}
          onValidExpr={setValidExpr}
          onExpressionChange={setExpression}
        />
        <ColumnRefChips columns={columns} onInsert={text => editorRef.current?.insertAtCursor(text)} />

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
              onClick={() => { if (validExpr) onApply(expression, validExpr) }}
            >
              適用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FilterModal
