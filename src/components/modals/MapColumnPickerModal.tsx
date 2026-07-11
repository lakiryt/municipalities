import type { ColumnRef } from '@/types'

type Props = {
  columns: ColumnRef[]
  onSelect: (id: number) => void
  onClose: () => void
}

// Picks which existing column the map colors by — same idea as referencing
// a column in the filter/sort modals (`@id`), just a direct pick instead of
// inserting into an expression editor, since the map only ever needs one.
function MapColumnPickerModal({ columns, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[360px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">地図に表示する列</h3>

        {columns.length === 0 ? (
          <p className="text-sm text-gray-500">数値の列がありません。先に列を追加してください。</p>
        ) : (
          <div className="space-y-1">
            {columns.map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-sm"
                onClick={() => onSelect(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}

export default MapColumnPickerModal
