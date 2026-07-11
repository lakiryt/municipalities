import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem, type DesignationSets } from '@/data/municipalities'
import type { ColumnState } from '@/types'
import {
  fetchMunicipalityPaths, sequentialColor, COLOR_SCHEMES, VIEW_SIZE,
  type MuniPaths, type ColorSchemeKey,
} from '@/lib/topoMap'

type Props = {
  columns: ColumnState[]
  displayItems: BaseItem[]
  designations: DesignationSets | undefined
  coastal: Set<string>
  onClose: () => void
}

const NO_DATA_FILL = '#e1e0d9'
const MIN_SCALE = 1
const MAX_SCALE = 40
const VIEW_CENTER = { x: VIEW_SIZE / 2, y: VIEW_SIZE / 2 }

type View = { scale: number; x: number; y: number }

// Rescales around `at` (an SVG-user-space point) so that point stays fixed
// on screen — the standard "zoom to cursor" pin.
function zoomAt(view: View, at: { x: number; y: number }, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor))
  if (scale === view.scale) return view
  const worldX = (at.x - view.x) / view.scale
  const worldY = (at.y - view.y) / view.scale
  return { scale, x: at.x - scale * worldX, y: at.y - scale * worldY }
}

function MapModal({ columns, displayItems, designations, coastal, onClose }: Props) {
  const numericColumns = useMemo(() => columns.filter(c => c.typed.type === 'n'), [columns])
  const [colId, setColId] = useState<number | null>(numericColumns[0]?.id ?? null)
  const [paths, setPaths] = useState<MuniPaths | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: number } | null>(null)
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [schemeKey, setSchemeKey] = useState<ColorSchemeKey>('blue')
  const [showBorders, setShowBorders] = useState(false)
  const [schemeOpen, setSchemeOpen] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const schemeRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startClientX: number; startClientY: number; startView: View; unitsPerPixel: number } | null>(null)

  useEffect(() => { fetchMunicipalityPaths().then(setPaths) }, [])

  // Closes the color scheme dropdown on an outside click.
  useEffect(() => {
    if (!schemeOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (schemeRef.current && !schemeRef.current.contains(e.target as Node)) setSchemeOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [schemeOpen])

  // Drag-to-pan: tracked on window so a release outside the SVG still ends it.
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = (e.clientX - drag.startClientX) * drag.unitsPerPixel
      const dy = (e.clientY - drag.startClientY) * drag.unitsPerPixel
      setView({ ...drag.startView, x: drag.startView.x + dx, y: drag.startView.y + dy })
    }
    const onUp = () => { dragRef.current = null; setIsDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  const selectedColumn = numericColumns.find(c => c.id === colId) ?? null

  // Keyed by 5-digit JIS code, matching the topojson properties.
  const itemByCode = useMemo(() => {
    const m = new Map<string, BaseItem>()
    for (const item of displayItems) m.set(item.code, item)
    return m
  }, [displayItems])

  const values = useMemo(() => {
    if (!selectedColumn || !paths) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const [code, item] of itemByCode) {
      // Codes without a drawn path would otherwise skew the color scale
      // toward values that never appear on the map itself. Prefecture-level
      // totals (code ending "000") are excluded outright too — a handful of
      // small islands are drawn under their prefecture's own code rather
      // than a municipality's, and coloring them by the prefecture's total
      // would be just as misleading as including the total itself.
      if (!paths.has(code) || code.endsWith('000')) continue
      const v = evaluate(selectedColumn.typed, baseItemEnv(item, designations, coastal)) as number
      if (!isNaN(v)) map.set(code, v)
    }
    return map
  }, [itemByCode, selectedColumn, designations, coastal, paths])

  const [min, max] = useMemo(() => {
    const vs = [...values.values()]
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 1]
  }, [values])

  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(ctm.inverse())
  }

  const zoomButton = (factor: number) => setView(v => zoomAt(v, VIEW_CENTER, factor))

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const at = clientToSvgPoint(e.clientX, e.clientY)
    if (!at) return
    setView(v => zoomAt(v, at, e.deltaY < 0 ? 1.2 : 1 / 1.2))
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startView: view, unitsPerPixel: 1 / ctm.a }
    setIsDragging(true)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-4 w-[92vw] h-[88vh] max-w-5xl flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-bold">地図表示</h3>
          <select
            aria-label="表示する列"
            className="border border-gray-300 rounded px-2 py-1 text-sm ml-auto"
            value={colId ?? ''}
            onChange={e => setColId(Number(e.target.value))}
          >
            {numericColumns.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 select-none">
            <input type="checkbox" checked={showBorders} onChange={e => setShowBorders(e.target.checked)} />
            境界線
          </label>
          <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
            <button
              aria-label="ズームイン"
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 border-r border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              disabled={view.scale >= MAX_SCALE}
              onClick={() => zoomButton(1.4)}
            >
              +
            </button>
            <button
              aria-label="ズームアウト"
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 border-r border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              disabled={view.scale <= MIN_SCALE}
              onClick={() => zoomButton(1 / 1.4)}
            >
              −
            </button>
            <button aria-label="ズームリセット" className="px-2 py-1 hover:bg-gray-50 text-xs" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>
              リセット
            </button>
          </div>
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          {!paths ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">読み込み中…</div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
            >
              <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
                {[...paths.entries()].map(([code, d]) => {
                  const v = values.get(code)
                  const ramp = COLOR_SCHEMES[schemeKey].ramp
                  const fill = v === undefined ? NO_DATA_FILL : sequentialColor(max === min ? 0.5 : (v - min) / (max - min), ramp)
                  return (
                    <path
                      key={code}
                      d={d}
                      fill={fill}
                      stroke={showBorders ? '#fcfcfb' : 'none'}
                      strokeWidth={0.5}
                      vectorEffect="non-scaling-stroke"
                      onMouseMove={e => {
                        if (isDragging) return
                        const item = itemByCode.get(code)
                        if (v === undefined || !item) { setHover(null); return }
                        setHover({ x: e.clientX, y: e.clientY, label: item.kanji, value: v })
                      }}
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}
              </g>
            </svg>
          )}
          {hover && (
            <div
              data-testid="map-tooltip"
              className="fixed pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
              style={{ left: hover.x + 12, top: hover.y + 12 }}
            >
              {hover.label}: {hover.value.toLocaleString('ja-JP')}
            </div>
          )}
        </div>

        {selectedColumn && (
          <div className="relative mt-3" ref={schemeRef}>
            <button
              type="button"
              data-testid="map-legend"
              aria-label="配色"
              aria-haspopup="listbox"
              aria-expanded={schemeOpen}
              title={COLOR_SCHEMES[schemeKey].label}
              className="flex items-center gap-2 w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-500 cursor-pointer shadow-sm hover:border-gray-400"
              onClick={() => setSchemeOpen(o => !o)}
            >
              <span>{min.toLocaleString('ja-JP')}</span>
              <span
                className="h-2 flex-1 rounded-sm block"
                style={{ background: `linear-gradient(to right, ${COLOR_SCHEMES[schemeKey].ramp.join(', ')})` }}
              />
              <span>{max.toLocaleString('ja-JP')}</span>
              <span className="text-gray-400">▾</span>
            </button>
            {schemeOpen && (
              <div
                role="listbox"
                className="absolute z-10 bottom-full mb-2 left-0 bg-white border border-gray-300 rounded shadow-lg py-1 w-44"
              >
                {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={schemeKey === key}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left hover:bg-gray-50 ${schemeKey === key ? 'bg-gray-50' : ''}`}
                    onClick={() => { setSchemeKey(key as ColorSchemeKey); setSchemeOpen(false) }}
                  >
                    <span
                      className="w-8 h-3 rounded flex-shrink-0"
                      style={{ background: `linear-gradient(to right, ${scheme.ramp.join(', ')})` }}
                    />
                    {scheme.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MapModal
