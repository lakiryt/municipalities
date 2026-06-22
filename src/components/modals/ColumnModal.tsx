import { useState } from 'react'
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import ExprEditor from '@/components/ExprEditor'

type Props = {
  initialLabel: string
  initialExpression: string
  isNew: boolean
  onSave: (label: string, expression: string, typed: TypedExpr) => void
  onDelete?: () => void
  onSetSort?: (expression: string, typed: TypedExpr) => void
  onClose: () => void
}

function ColumnModal({ initialLabel, initialExpression, isNew, onSave, onDelete, onSetSort, onClose }: Props) {
  const [label, setLabel]       = useState(initialLabel)
  const [expression, setExpression] = useState(initialExpression)
  const [validExpr, setValidExpr]   = useState<TypedExpr | null>(() => {
    if (!initialExpression.trim()) return null
    try { return parseAndTypeCheck(initialExpression) } catch { return null }
  })

  const canSave = label.trim() !== '' && validExpr !== null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[520px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">{isNew ? '列を追加' : '列を編集'}</h3>

        <label className="block text-sm font-medium mb-1">ラベル</label>
        <input
          className="border border-gray-300 rounded px-2 py-1 w-full mb-4 text-sm"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="列名"
          autoFocus
        />

        <label className="block text-sm font-medium mb-1">式</label>
        <ExprEditor
          initialExpression={initialExpression}
          placeholder='SUM(#inc_mov, NEG(#dec_mov))'
          onValidExpr={setValidExpr}
          onExpressionChange={setExpression}
        />

        <div className="flex justify-between mt-5">
          <div className="flex gap-2">
            {onDelete && (
              <button className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm" onClick={onDelete}>
                削除
              </button>
            )}
            {onSetSort && (
              <button
                className="px-3 py-1 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!validExpr}
                onClick={() => { if (validExpr) onSetSort(expression, validExpr) }}
              >
                この列で並び替える
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
              キャンセル
            </button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!canSave}
              onClick={() => { if (canSave && validExpr) onSave(label.trim(), expression, validExpr) }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ColumnModal
