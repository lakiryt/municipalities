import type { ColumnRef } from '@/types'

type Props = {
  columns: ColumnRef[]
  onInsert: (text: string) => void
}

// Column ids are stable but not visible anywhere in the UI otherwise, so
// without this a user would have no way to know what `@3` even refers to.
function ColumnRefChips({ columns, onInsert }: Props) {
  if (columns.length === 0) return null

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-400 mb-1">列を参照:</p>
      <div className="flex flex-wrap gap-1">
        {columns.map(c => (
          <button
            key={c.id}
            type="button"
            className="px-2 py-0.5 text-xs font-mono border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50"
            onClick={() => onInsert(`@${c.id}`)}
          >
            @{c.id} {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ColumnRefChips
