import { useState } from 'react'
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import FilterInput from '@/components/inputs/FilterInput'
import SortInput from '@/components/inputs/SortInput'
import ColumnInput from '@/components/inputs/ColumnInput'
import {
  buildFilterExpr, DEFAULT_FILTER_STATE, DEFAULT_ACTIVE_COLS, DEFAULT_SORT_KEY,
  ALL_SORT_OPTIONS, COL_MAP, COL_TYPED,
  type FilterState, type ColKey,
} from '@/data/columnDefs'
import type { ColumnState } from '@/types'

type Props = {
  onApply: (result: {
    filterExpr: TypedExpr | null
    filterExpression: string
    sortExpression: string
    sortTyped: TypedExpr | null
    sortDirection: 'asc' | 'desc'
    columns: ColumnState[]
  }) => void
  onClose: () => void
}

function SearchModal({ onApply, onClose }: Props) {
  const [filter, setFilter]   = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [colKeys, setColKeys] = useState<ColKey[]>(DEFAULT_ACTIVE_COLS)

  const handleApply = () => {
    const filterExpr = buildFilterExpr(filter)
    let filterExprTyped: TypedExpr | null = null
    let filterExpression = ''
    if (filterExpr) {
      try {
        const t = parseAndTypeCheck(filterExpr)
        if (t.type === 'b') { filterExprTyped = t; filterExpression = filterExpr }
      } catch { /* skip */ }
    }

    const opt = ALL_SORT_OPTIONS.find(o => o.key === sortKey)

    const columns: ColumnState[] = colKeys.map((key, i) => ({
      id: i,
      label: COL_MAP[key].label,
      expression: COL_MAP[key].expr,
      typed: COL_TYPED[key],
    }))

    onApply({
      filterExpr: filterExprTyped,
      filterExpression,
      sortExpression: opt?.expr ?? '',
      sortTyped: opt?.typed ?? null,
      sortDirection: sortDir,
      columns,
    })
  }

  const btnBase     = 'flex-1 py-1 text-sm rounded border'
  const btnActive   = 'bg-blue-600 text-white border-blue-600'
  const btnInactive = 'border-gray-300 hover:bg-gray-50'
  const sectionHead = 'text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3'

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold">詳細検索</h3>
          <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <p className={sectionHead}>絞り込み</p>
            <FilterInput value={filter} onChange={setFilter} />
          </section>

          <section className="border-t border-gray-200 pt-5">
            <p className={sectionHead}>並べ替え</p>
            <SortInput value={{ key: sortKey }} onChange={s => setSortKey(s.key)} />
            <div className="flex gap-1 mt-2">
              {(['desc', 'asc'] as const).map(dir => (
                <button key={dir} onClick={() => setSortDir(dir)} className={`${btnBase} ${sortDir === dir ? btnActive : btnInactive}`}>
                  {dir === 'desc' ? '↓ 降順' : '↑ 昇順'}
                </button>
              ))}
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <p className={sectionHead}>表示する列</p>
            <ColumnInput value={colKeys} onChange={setColKeys} />
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button className="px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={colKeys.length === 0}
            onClick={handleApply}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  )
}

export default SearchModal
