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
      <div className="px-6 pb-6">
        <table className="border-collapse border border-gray-300">
          <thead className="sticky top-0 z-10 shadow-md">
            <tr>
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
            {displayItems.map(item => (
              <tr key={item.code}>
                {columns.map(col => (
                  <td key={col.id} className="border border-gray-300 px-4 py-2">
                    {String(evaluate(col.typed, baseItemEnv(item)))}
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
