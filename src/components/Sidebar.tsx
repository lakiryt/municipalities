import { Link } from 'react-router-dom'
import type { SortState } from '../types'

type Props = {
  totalCount: number
  filteredCount: number
  filterActive: boolean
  sortState: SortState | null
  onSortClick: () => void
  onFilterClick: () => void
  onDataClick: () => void
  onClose: () => void
}

function Sidebar({ totalCount, filteredCount, filterActive, sortState, onSortClick, onFilterClick, onDataClick, onClose }: Props) {
  const btnBase     = 'w-full px-3 py-2 rounded text-sm border text-left'
  const btnActive   = 'bg-blue-600 text-white border-blue-600'
  const btnInactive = 'border-gray-300 hover:bg-gray-50'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-40 flex flex-col">
        <div className="flex items-center justify-between h-11 px-4 border-b border-gray-200">
          <span className="text-sm font-semibold">メニュー</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 leading-none text-lg">✕</button>
        </div>

        <div className="md:hidden flex flex-col gap-2 p-4">
          <button className={`${btnBase} ${btnInactive}`} onClick={onDataClick}>データ選択</button>
          <button className={`${btnBase} ${sortState ? btnActive : btnInactive}`} onClick={onSortClick}>並べ替え</button>
          <button className={`${btnBase} ${filterActive ? btnActive : btnInactive}`} onClick={onFilterClick}>
            絞り込み{filterActive ? `（${filteredCount} / ${totalCount}件）` : ''}
          </button>
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <Link to="/formulas" onClick={onClose} className="text-sm text-blue-500 hover:underline">
            式の記述方法 →
          </Link>
        </div>

        <div className="mt-auto p-4 text-xs text-gray-400">
          <p>© 2026 <a target="_blank" rel="noopener noreferrer" href="https://lakiryt.com">Lakiryt</a></p>
        </div>
      </div>
    </>
  )
}

export default Sidebar
