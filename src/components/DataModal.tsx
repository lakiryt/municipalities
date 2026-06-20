import { useState } from 'react'
import { areaSources } from '../data/municipalities'

type Props = {
  selectedAsOf: string
  onApply: (asOf: string) => void
  onClose: () => void
}

function DataModal({ selectedAsOf, onApply, onClose }: Props) {
  const [pending, setPending] = useState(selectedAsOf)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[400px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">データの選択</h3>

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">面積データ</p>
        <ul className="space-y-1 mb-6">
          {areaSources.map(src => (
            <li key={src.as_of}>
              <label className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="area"
                  value={src.as_of}
                  checked={pending === src.as_of}
                  onChange={() => setPending(src.as_of)}
                />
                <span className="text-sm">{src.as_of}</span>
                <span className="text-xs text-gray-400 ml-auto">{src.agency}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            onClick={() => onApply(pending)}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataModal
