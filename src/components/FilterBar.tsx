import { Link } from 'react-router-dom'
import type { SortState } from '../types'

type Props = {
  title?: string
  totalCount: number
  filteredCount: number
  filterActive: boolean
  sortState: SortState | null
  onSortClick: () => void
  onFilterClick: () => void
  onDataClick: () => void
  onMenuClick: () => void
}

function FilterBar({ title, totalCount, filteredCount, filterActive, sortState, onSortClick, onFilterClick, onDataClick, onMenuClick }: Props) {
  const btnBase     = 'px-3 py-1 rounded text-sm border'
  const btnActive   = 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
  const btnInactive = 'border-gray-300 hover:bg-gray-50'

  return (
    <div className="fixed top-0 inset-x-0 z-20 h-11 flex items-center gap-3 bg-gray-50 border-b border-gray-200 px-4">
      <Link to="/"><img src="/favicon.svg" alt="home" className="h-6 w-6" /></Link>
      <span className="font-semibold text-sm truncate">{title}</span>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-3">
          <button className={`${btnBase} ${btnInactive}`} onClick={onDataClick}>データ選択</button>
          <button className={`${btnBase} ${sortState ? btnActive : btnInactive}`} onClick={onSortClick}>並べ替え</button>
          <button className={`${btnBase} ${filterActive ? btnActive : btnInactive}`} onClick={onFilterClick}>
            絞り込み{filterActive ? `（${filteredCount} / ${totalCount}件）` : ''}
          </button>
        </div>
        <button
          className="p-1.5 rounded hover:bg-gray-200 flex flex-col gap-1 justify-center"
          onClick={onMenuClick}
          aria-label="メニュー"
        >
          <span className="block w-4 h-px bg-gray-600" />
          <span className="block w-4 h-px bg-gray-600" />
          <span className="block w-4 h-px bg-gray-600" />
        </button>
      </div>
    </div>
  )
}

export default FilterBar
