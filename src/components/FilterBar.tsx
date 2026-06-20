import { Link } from 'react-router-dom'
import type { ColumnState, SortState } from '../types'

type Props = {
  title?: string
  numericColumns: ColumnState[]
  totalCount: number
  filteredCount: number
  filterActive: boolean
  sortState: SortState | null
  onSortChange: (state: SortState | null) => void
  onFilterClick: () => void
}

function FilterBar({ title, numericColumns, totalCount, filteredCount, filterActive, sortState, onSortChange, onFilterClick }: Props) {
  return (
    <div className="fixed top-0 inset-x-0 z-20 h-11 flex items-center gap-3 bg-gray-50 border-b border-gray-200 px-4">
      <Link to="/"><img src="/favicon.svg" alt="home" className="h-6 w-6" /></Link>
      <span className="font-semibold text-sm truncate">{title}</span>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500">並べ替え：</span>
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer hover:bg-gray-50"
            value={sortState?.columnId ?? ''}
            onChange={e => {
              const raw = e.target.value
              onSortChange(raw === '' ? null : { columnId: Number(raw), direction: sortState?.direction ?? 'asc' })
            }}
          >
            <option value="">なし</option>
            {numericColumns.map(col => (
              <option key={col.id} value={col.id}>{col.label}</option>
            ))}
          </select>
          {sortState !== null && (
            <button
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
              onClick={() => onSortChange({ ...sortState, direction: sortState.direction === 'asc' ? 'desc' : 'asc' })}
            >
              {sortState.direction === 'asc' ? '↑' : '↓'}
            </button>
          )}
        </div>
        <button
          className={`px-3 py-1 rounded text-sm border ${filterActive ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
          onClick={onFilterClick}
        >
          絞り込み{filterActive ? `（${filteredCount} / ${totalCount}件）` : ''}
        </button>
      </div>
    </div>
  )
}

export default FilterBar
