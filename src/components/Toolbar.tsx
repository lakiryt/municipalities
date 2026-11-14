type Props = {
  view: 'table' | 'map'
  mapAvailable: boolean
  onViewChange: (view: 'table' | 'map') => void
  sortLabel: string | null       // what the rows are ordered by, or null
  sortDirection: 'asc' | 'desc'
  filterLabel: string | null     // a short description of the filter, or null
  shownCount: number
  totalCount: number
  onSortClick: () => void
  onFilterClick: () => void
}

const chip = 'shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm whitespace-nowrap'
const chipOff = `${chip} border-gray-300 bg-white hover:bg-gray-50`
const chipOn = `${chip} border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100`

// Sticks to the top of the page while scrolling: the 表/地図 switch and the
// current sort and filter, shown as chips so their state is visible (and
// one tap away) on every screen size. Scrolls sideways on narrow screens.
function Toolbar({
  view, mapAvailable, onViewChange, sortLabel, sortDirection, filterLabel, shownCount, totalCount,
  onSortClick, onFilterClick,
}: Props) {
  const tab = (v: 'table' | 'map', label: string, disabled = false) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      disabled={disabled}
      title={disabled ? '数値の列がないため地図にできません' : undefined}
      onClick={() => onViewChange(v)}
      className={`px-3 py-1 text-sm rounded-md ${view === v ? 'bg-white shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-40`}
    >
      {label}
    </button>
  )

  return (
    <div className="h-12 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="h-full max-w-5xl mx-auto px-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div role="tablist" aria-label="表示" className="shrink-0 flex rounded-lg bg-gray-100 p-0.5">
          {tab('table', '表')}
          {tab('map', '地図', !mapAvailable)}
        </div>
        <button type="button" className={sortLabel ? chipOn : chipOff} onClick={onSortClick} aria-label="並べ替え">
          {sortLabel ? <>並び：<span className="max-w-[14rem] truncate">{sortLabel}</span> {sortDirection === 'desc' ? '↓' : '↑'}</> : '並べ替え'}
        </button>
        <button type="button" className={filterLabel ? chipOn : chipOff} onClick={onFilterClick} aria-label="絞り込み">
          {filterLabel ? <>絞り込み：{filterLabel}</> : '絞り込み'}
        </button>
        <span className="shrink-0 ml-auto pl-2 text-xs text-gray-500 tabular-nums">
          {shownCount === totalCount ? `${totalCount.toLocaleString('ja-JP')}件` : `${shownCount.toLocaleString('ja-JP')} / ${totalCount.toLocaleString('ja-JP')}件`}
        </span>
      </div>
    </div>
  )
}

export default Toolbar
