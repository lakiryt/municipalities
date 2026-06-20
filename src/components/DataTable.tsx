import { evaluate } from '../lang/evaluate'
import { baseItemEnv, type BaseItem } from '../data/municipalities'
import type { ColumnState } from '../types'

type Props = {
  columns: ColumnState[]
  displayItems: BaseItem[]
  onEditColumn: (id: number) => void
  onAddColumn: () => void
}

function DataTable({ columns, displayItems, onEditColumn, onAddColumn }: Props) {
  return (
    <div className="fixed inset-x-0 top-11 bottom-0 overflow-auto">
      <div className="pb-6 flex justify-center">
        <table className="border-collapse border border-gray-300">
          <thead className="sticky top-0 z-10 shadow-md">
            <tr>
              <th className="border border-gray-300 bg-gray-50 px-4 py-2 text-gray-400 select-none">#</th>
              {columns.map(col => (
                <th
                  key={col.id}
                  className="border border-gray-300 bg-gray-50 px-4 py-2 cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => onEditColumn(col.id)}
                >
                  {col.label}
                </th>
              ))}
              <th
                className="border border-gray-300 bg-gray-50 px-4 py-2 cursor-pointer hover:bg-gray-100 text-gray-400 select-none"
                onClick={onAddColumn}
              >
                +
              </th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, i) => (
              <tr key={item.code}>
                <td className="border border-gray-300 px-4 py-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                {columns.map(col => (
                  <td key={col.id} className="border border-gray-300 px-4 py-2">
                    {(() => { const v = evaluate(col.typed, baseItemEnv(item)); return typeof v === 'number' && isNaN(v) ? '—' : String(v) })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
