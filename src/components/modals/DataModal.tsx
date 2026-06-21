import { useState } from 'react'
import { areaSources, populationSources } from '@/data/municipalities'

type Props = {
  selectedAreaPath: string
  selectedPopPath: string
  onApply: (areaPath: string, popPath: string) => void
  onClose: () => void
}

type Source = { label: string; as_of: string; path: string }

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

  return (
    <div className="space-y-1 mb-5">
      {groups.map(([label, srcs]) => {
        const isActive = label === activeLabel
        return (
          <label
            key={label}
            className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-50"
          >
            <input
              type="radio"
              name={radioName}
              checked={isActive}
              onChange={() => {
                const match = srcs.find(s => s.as_of === selectedSrc?.as_of)
                onChange((match ?? srcs[0]).path)
              }}
            />
            <span className="text-sm flex-1">{label}</span>
            <select
              className={`text-xs border border-gray-200 rounded px-1 py-0.5 bg-white ${
                isActive ? '' : 'pointer-events-none opacity-40'
              }`}
              value={isActive ? selectedPath : srcs[0].path}
              tabIndex={isActive ? 0 : -1}
              onChange={e => onChange(e.target.value)}
            >
              {srcs.map(src => (
                <option key={src.path} value={src.path}>{src.as_of}</option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  )
}

function DataModal({ selectedAreaPath, selectedPopPath, onApply, onClose }: Props) {
  const [pendingAreaPath, setPendingAreaPath] = useState(selectedAreaPath)
  const [pendingPopPath, setPendingPopPath] = useState(selectedPopPath)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-[440px] max-w-[calc(100vw-2rem)]">
        <h3 className="text-lg font-bold mb-4">データの選択</h3>

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">人口データ</p>
        <SourceSection
          radioName="pop"
          sources={populationSources}
          selectedPath={pendingPopPath}
          onChange={setPendingPopPath}
        />

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">面積データ</p>
        <SourceSection
          radioName="area"
          sources={areaSources}
          selectedPath={pendingAreaPath}
          onChange={setPendingAreaPath}
        />

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            onClick={() => onApply(pendingAreaPath, pendingPopPath)}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataModal
