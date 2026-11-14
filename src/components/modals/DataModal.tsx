import { useState } from 'react'
import {
  areaSources, populationSources, rentSources, minWageSources, type Source, type DataSelection,
} from '@/data/municipalities'

const SECTIONS: { key: keyof DataSelection; title: string; sources: Source[] }[] = [
  { key: 'pop',     title: '人口データ',   sources: populationSources },
  { key: 'area',    title: '面積データ',   sources: areaSources },
  { key: 'rent',    title: '家賃データ',   sources: rentSources },
  { key: 'minwage', title: '最低賃金',     sources: minWageSources },
]

type Props = {
  selection: DataSelection
  onApply: (selection: DataSelection) => void
  onClose: () => void
}

function groupByLabel(sources: Source[]): [string, Source[]][] {
  const map = new Map<string, Source[]>()
  for (const src of sources) {
    if (!map.has(src.label)) map.set(src.label, [])
    map.get(src.label)!.push(src)
  }
  return [...map.entries()]
}

function SourceSection({ radioName, sources, selectedPath, onChange }: {
  radioName: string
  sources: Source[]
  selectedPath: string
  onChange: (path: string) => void
}) {
  const groups = groupByLabel(sources)
  const selectedSrc = sources.find(s => s.path === selectedPath)
  const activeLabel = selectedSrc?.label ?? groups[0]?.[0] ?? ''
  // With a single source (e.g. 家賃 = 住宅・土地統計調査 only) there's nothing
  // to choose between, so no radio — just the edition picker.
  const single = groups.length === 1

  return (
    <div className="space-y-1 mb-5">
      {groups.map(([label, srcs]) => {
        const isActive = label === activeLabel
        return (
          <label
            key={label}
            className={`flex items-center gap-3 px-3 py-2 rounded ${single ? '' : 'cursor-pointer hover:bg-gray-50'}`}
          >
            {!single && (
              <input
                type="radio"
                name={radioName}
                checked={isActive}
                onChange={() => {
                  const match = srcs.find(s => s.as_of === selectedSrc?.as_of)
                  onChange((match ?? srcs[0]).path)
                }}
              />
            )}
            <span className="text-sm flex-1">{label}</span>
            <select
              className={`text-xs border border-gray-200 rounded px-1 py-0.5 bg-white max-w-[60%] ${
                isActive ? '' : 'pointer-events-none opacity-40'
              }`}
              value={isActive ? selectedPath : srcs[0].path}
              tabIndex={isActive ? 0 : -1}
              onChange={e => onChange(e.target.value)}
            >
              {srcs.map(src => (
                <option key={src.path} value={src.path}>{src.name}</option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  )
}

function DataModal({ selection, onApply, onClose }: Props) {
  const [pending, setPending] = useState(selection)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[460px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">データの選択</h3>

        {SECTIONS.filter(s => s.sources.length > 0).map(s => (
          <div key={s.key}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{s.title}</p>
            <SourceSection
              radioName={s.key}
              sources={s.sources}
              selectedPath={pending[s.key]}
              onChange={path => setPending(p => ({ ...p, [s.key]: path }))}
            />
          </div>
        ))}

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
