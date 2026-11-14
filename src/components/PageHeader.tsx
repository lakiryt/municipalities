import { SELECTABLE, selectedSource, type DataKey, type DataSelection } from '@/data/datasets'

type Props = {
  title?: string
  description?: string
  // Datasets the columns/filter/sort on screen draw on, in display order.
  used: DataKey[]
  selection: DataSelection
  onDataClick: () => void
  compact?: boolean
}

// Title, what the page shows, and which data (and which edition of it) the
// numbers come from — where a reader looks for "where is this from?", not
// tucked away in a menu. Each data chip opens データの選択.
function PageHeader({ title, description, used, selection, onDataClick, compact = false }: Props) {
  return (
    <div className={`w-full max-w-5xl mx-auto px-4 ${compact ? 'pt-2 pb-1' : 'pt-4 pb-3'}`}>
      {title && <h1 className={`font-bold ${compact ? 'text-base truncate' : 'text-xl md:text-2xl'}`}>{title}</h1>}
      {description && !compact && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      <div className={`flex items-center gap-1.5 text-xs ${compact ? 'mt-1 overflow-x-auto whitespace-nowrap no-scrollbar' : 'mt-2 flex-wrap'}`}>
        <span className="text-gray-500 shrink-0">データ：</span>
        {used.map(k => {
          const src = selectedSource(k, selection)
          if (!src) return null
          return (
            <button
              key={k}
              type="button"
              onClick={onDataClick}
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-0.5 hover:border-blue-400 hover:text-blue-700"
              title={`${SELECTABLE[k].title}のデータを選ぶ`}
            >
              <span className="text-gray-500">{SELECTABLE[k].title}</span>
              {/* "現在（都道府県ごとに発効済みの額）" is spelled out in the dialog; a chip just says 現在. */}
              <span className="font-medium">{src.label} {src.key === 'effective' ? '現在' : src.name}</span>
              <span className="text-gray-400">▾</span>
            </button>
          )
        })}
        <button type="button" onClick={onDataClick} className="shrink-0 text-blue-600 hover:underline px-1">
          データの選択
        </button>
      </div>
    </div>
  )
}

export default PageHeader
