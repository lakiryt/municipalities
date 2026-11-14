import { useEffect, useRef, useState } from 'react'
import { SELECTABLE, DATA_KEYS, type Source, type DataSelection, type DataKey } from '@/data/datasets'

type Props = {
  selection: DataSelection
  // Opened from one data chip: that section is highlighted, scrolled to and
  // focused, and named in the title.
  focus?: DataKey
  // Data the page actually uses; the rest is folded away below.
  used?: DataKey[]
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

function SourceSection({ radioName, sources, selectedPath, onChange, autoFocus = false }: {
  radioName: string
  sources: Source[]
  selectedPath: string
  onChange: (path: string) => void
  autoFocus?: boolean
}) {
  const groups = groupByLabel(sources)
  const selectedSrc = sources.find(s => s.path === selectedPath)
  const activeLabel = selectedSrc?.label ?? groups[0]?.[0] ?? ''
  // With a single source (e.g. 家賃 = 住宅・土地統計調査 only) there's nothing
  // to choose between, so no radio — just the edition picker.
  const single = groups.length === 1

  return (
    <div className="space-y-1">
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
              autoFocus={autoFocus && isActive}
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

function DataModal({ selection, focus, used, onApply, onClose }: Props) {
  const [pending, setPending] = useState(selection)
  const focusedRef = useRef<HTMLDivElement>(null)
  useEffect(() => { focusedRef.current?.scrollIntoView({ block: 'nearest' }) }, [])

  const available = DATA_KEYS.filter(k => SELECTABLE[k].sources.length > 0)
  const primary = used ? available.filter(k => used.includes(k)) : available
  const others = available.filter(k => !primary.includes(k))

  const section = (k: DataKey) => {
    const focused = k === focus
    return (
      <div
        key={k}
        ref={focused ? focusedRef : undefined}
        data-focused={focused || undefined}
        className={`rounded-lg p-2 -mx-2 mb-3 ${focused ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
      >
        <p className={`text-xs font-semibold tracking-widest mb-1 ${focused ? 'text-blue-700' : 'text-gray-400'}`}>
          {SELECTABLE[k].title}データ
        </p>
        <SourceSection
          radioName={k}
          sources={SELECTABLE[k].sources}
          selectedPath={pending[k]}
          onChange={path => setPending(p => ({ ...p, [k]: path }))}
          autoFocus={focused}
        />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" aria-label="データの選択" className="bg-white rounded-lg shadow-xl p-6 w-[460px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">
          データの選択{focus && <span className="text-blue-700"> — {SELECTABLE[focus].title}</span>}
        </h3>

        {primary.map(section)}

        {others.length > 0 && (
          <details className="mb-4" open={focus !== undefined && others.includes(focus)}>
            <summary className="cursor-pointer text-xs text-gray-500 mb-2">
              このページで使っていないデータ（{others.map(k => SELECTABLE[k].title).join('・')}）
            </summary>
            {others.map(section)}
          </details>
        )}

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
