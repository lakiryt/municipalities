import { evaluate } from '../lang/evaluate'
import type { BaseItem } from '../data/municipalities'
import type { Env } from '../lang/evaluate'
import type { ColumnState } from '../types'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatValue } from '@/lib/format'

type Props = {
  columns: ColumnState[]
  displayItems: BaseItem[]
  // Each row's variables, computed once by the page (see MuniTable).
  envOf: (item: BaseItem) => Env
  // The column the rows are ordered by (highlighted), and in which direction.
  sortedColumnId: number | null
  sortDirection: 'asc' | 'desc'
  onEditColumn: (id: number) => void
  onAddColumn: () => void
  onSortColumn: (id: number) => void
  // Where a municipality's name links to (its detail page).
  linkFor: (code: string) => string
  // A row to mark and scroll to (e.g. arriving from a municipality's rank).
  highlight?: string
}

// Header labels wrap (max-w-44) so one long label — "平均家賃30㎡分を稼ぐの
// に必要な最低賃金労働日数" — can't push every value off a phone screen.
// Sticky offsets, relative to the page's scroll container: the header rows
// sit under the toolbar (h-12); the rank column is exactly w-12 (padding
// trimmed so 4-digit ranks fit), so a sticky name
// column starts at left-12.
const TH = 'sticky top-12 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 font-semibold text-sm select-none align-bottom'
const TD = 'border-b border-r border-gray-200 px-3 py-1.5'

// The rank column and — when it's the first column, as on every ranking
// page — the municipality name stay put while the rest scrolls sideways,
// so a row is always identifiable on a narrow screen.
function DataTable({
  columns, displayItems, envOf, sortedColumnId, sortDirection, onEditColumn, onAddColumn, onSortColumn, linkFor, highlight,
}: Props) {
  const stickyName = columns[0]?.expression === '$kanji'

  // Scroll the highlighted row into view once, as soon as it's rendered.
  const highlightRef = useRef<HTMLTableRowElement>(null)
  const scrolledTo = useRef<string | undefined>(undefined)
  const highlightShown = !!highlight && displayItems.some(i => i.code === highlight)
  useEffect(() => {
    if (!highlightShown || scrolledTo.current === highlight) return
    scrolledTo.current = highlight
    highlightRef.current?.scrollIntoView({ block: 'center' })
  }, [highlight, highlightShown])

  return (
    <div className="flex justify-center min-w-max md:px-4">
      <table className="border-separate border-spacing-0 border-l border-gray-200 text-sm">
        <thead>
          <tr>
            <th className={`${TH} left-0 z-30 w-12 min-w-12 max-w-12 !px-2 text-gray-400 text-right`}>#</th>
            {columns.map((col, i) => {
              const sorted = col.id === sortedColumnId
              const sticky = stickyName && i === 0
              return (
                <th
                  key={col.id}
                  aria-label={col.label}
                  // The whole header opens the column menu (edit / sort / map);
                  // only the sort icon does something else.
                  onClick={() => onEditColumn(col.id)}
                  className={`${TH} max-w-44 cursor-pointer hover:bg-gray-100 ${sticky ? 'left-12 z-30' : ''} ${sorted ? 'text-blue-700 bg-blue-50' : ''} ${col.typed.type === 'n' ? 'text-right' : 'text-left'}`}
                >
                  <div className={`flex items-center gap-1 ${col.typed.type === 'n' ? 'justify-end' : ''}`}>
                    <button type="button" className="text-left leading-snug" title="列の編集・並べ替え・地図">
                      {col.label}
                    </button>
                    {col.typed.type !== 'b' && (
                      <button
                        type="button"
                        aria-label={`${col.label}で並べ替え`}
                        className={`shrink-0 w-5 text-xs rounded ${sorted ? 'text-blue-700' : 'text-gray-300 hover:text-gray-600'}`}
                        onClick={e => { e.stopPropagation(); onSortColumn(col.id) }}
                      >
                        {sorted ? (sortDirection === 'desc' ? '▼' : '▲') : '⇅'}
                      </button>
                    )}
                  </div>
                </th>
              )
            })}
            <th className={`${TH} text-gray-400 cursor-pointer hover:bg-gray-100`} onClick={onAddColumn} aria-label="+" title="列を追加">
              +
            </th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, i) => {
            const env = envOf(item)
            const marked = item.code === highlight
            return (
              <tr
                key={item.code}
                ref={marked ? highlightRef : undefined}
                aria-current={marked ? 'true' : undefined}
                className={`group ${marked ? '[&>td]:!bg-[#fdf3d0]' : ''}`}
              >
                <td className={`${TD} sticky left-0 z-10 bg-white group-hover:bg-gray-50 w-12 min-w-12 max-w-12 !px-2 text-right text-gray-400 tabular-nums text-xs`}>{i + 1}</td>
                {columns.map((col, ci) => {
                  const numeric = col.typed.type === 'n'
                  const sorted = col.id === sortedColumnId
                  const sticky = stickyName && ci === 0
                  return (
                    <td
                      key={col.id}
                      className={`${TD} whitespace-nowrap ${numeric ? 'text-right tabular-nums' : ''} ${sticky ? 'sticky left-12 z-10 font-medium' : ''} ${sorted ? 'bg-blue-50/60' : sticky ? 'bg-white' : ''} group-hover:bg-gray-50`}
                    >
                      {col.expression === '$kanji'
                        ? <Link to={linkFor(item.code)} className="text-blue-700 hover:underline">{formatValue(evaluate(col.typed, env))}</Link>
                        : formatValue(evaluate(col.typed, env))}
                    </td>
                  )
                })}
                <td className={`${TD} group-hover:bg-gray-50`} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
