import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem, type DesignationSets } from '@/data/municipalities'
import type { ColumnState } from '@/types'
import {
  fetchMunicipalityPaths, sequentialColor, COLOR_SCHEMES, VIEW_SIZE,
  type MuniPaths, type ColorSchemeKey,
} from '@/lib/topoMap'

type Props = {
  column: ColumnState
  displayItems: BaseItem[]
  designations: DesignationSets | undefined
  coastal: Set<string>
  onClose: () => void
}

const NO_DATA_FILL = '#e1e0d9'
const MIN_SCALE = 1
const MAX_SCALE = 40

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

function MapModal({ column, displayItems, designations, coastal, onClose }: Props) {
  const [paths, setPaths] = useState<MuniPaths | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: number } | null>(null)
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [schemeKey, setSchemeKey] = useState<ColorSchemeKey>('blue')
  const [showBorders, setShowBorders] = useState(false)
  const [schemeOpen, setSchemeOpen] = useState(false)
  const [showHistogram, setShowHistogram] = useState(false)
  const [barHover, setBarHover] = useState<{ x: number; y: number; x0: number; x1: number; count: number } | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const schemeRef = useRef<HTMLDivElement>(null)
  const mapAreaRef = useRef<HTMLDivElement>(null)
  const gradientRef = useRef<HTMLSpanElement>(null)
  const [barRect, setBarRect] = useState<{ left: number; width: number } | null>(null)
  const dragRef = useRef<{ startClientX: number; startClientY: number; startView: View; unitsPerPixel: number } | null>(null)
  const touchRef = useRef<
    | { kind: 'pan'; lastClientX: number; lastClientY: number }
    | { kind: 'pinch'; lastDistance: number }
    | null
  >(null)

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

  // Keyed by 5-digit JIS code, matching the topojson properties.
  const itemByCode = useMemo(() => {
    const m = new Map<string, BaseItem>()
    for (const item of displayItems) m.set(item.code, item)
    return m
  }, [displayItems])

  const values = useMemo(() => {
    if (!paths) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const [code, item] of itemByCode) {
      // Codes without a drawn path would otherwise skew the color scale
      // toward values that never appear on the map itself. Prefecture-level
      // totals (code ending "000") are excluded outright too — a handful of
      // small islands are drawn under their prefecture's own code rather
      // than a municipality's, and coloring them by the prefecture's total
      // would be just as misleading as including the total itself.
      if (!paths.has(code) || code.endsWith('000')) continue
      const v = evaluate(column.typed, baseItemEnv(item, designations, coastal)) as number
      if (!isNaN(v)) map.set(code, v)
    }
    return map
  }, [itemByCode, column, designations, coastal, paths])

  const [min, max] = useMemo(() => {
    const vs = [...values.values()]
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 1]
  }, [values])

  // Same domain as the map's color scale, so a bar's horizontal position
  // lines up with where its value falls on the legend gradient below.
  const BIN_COUNT = 20
  const bins = useMemo(() => {
    const vs = [...values.values()]
    if (vs.length === 0) return []
    const width = max === min ? 1 : (max - min) / BIN_COUNT
    const counts = new Array(BIN_COUNT).fill(0)
    for (const v of vs) {
      const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((v - min) / width)))
      counts[idx]++
    }
    return counts.map((count, i) => ({ x0: min + i * width, x1: min + (i + 1) * width, count }))
  }, [values, min, max])

  const maxCount = Math.max(1, ...bins.map(b => b.count))

  // Keeps the histogram overlay's left/width pinned to the legend's colored
  // gradient span (not the whole legend bar, which also has min/max labels
  // and the dropdown arrow), so a bar's x-position lines up with its color
  // on the legend beneath it.
  useEffect(() => {
    const area = mapAreaRef.current
    const gradient = gradientRef.current
    if (!area || !gradient) return
    const measure = () => {
      const a = area.getBoundingClientRect()
      const g = gradient.getBoundingClientRect()
      setBarRect({ left: g.left - a.left, width: g.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    ro.observe(gradient)
    return () => ro.disconnect()
  }, [min, max, schemeKey])

  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(ctm.inverse())
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startView: view, unitsPerPixel: 1 / ctm.a }
    setIsDragging(true)
  }

  // Wheel-zoom and one-finger-pan/two-finger-pinch, all registered as native
  // (non-React) listeners below, not JSX onWheel/onTouch* props: React
  // attaches its synthetic wheel/touchstart/touchmove listeners as passive,
  // which silently no-ops preventDefault() — without a real preventDefault(),
  // the page (and the table behind this modal) scrolls/zooms right along
  // with the map. touch-action: none (below) covers most of the pinch case
  // on mobile, but wheel scroll on desktop has no CSS equivalent, so a
  // genuinely non-passive listener is the only fix for both.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const at = clientToSvgPoint(e.clientX, e.clientY)
      if (!at) return
      setView(v => zoomAt(v, at, e.deltaY < 0 ? 1.2 : 1 / 1.2))
    }

    const touchDistance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    const touchMidpoint = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    })

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) e.preventDefault()
      if (e.touches.length === 1) {
        touchRef.current = { kind: 'pan', lastClientX: e.touches[0].clientX, lastClientY: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        touchRef.current = { kind: 'pinch', lastDistance: touchDistance(e.touches) }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const state = touchRef.current
      if (!state) return
      e.preventDefault()
      if (state.kind === 'pan' && e.touches.length === 1) {
        const ctm = svg.getScreenCTM()
        if (!ctm) return
        const unitsPerPixel = 1 / ctm.a
        const t = e.touches[0]
        const dx = (t.clientX - state.lastClientX) * unitsPerPixel
        const dy = (t.clientY - state.lastClientY) * unitsPerPixel
        setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
        touchRef.current = { kind: 'pan', lastClientX: t.clientX, lastClientY: t.clientY }
      } else if (state.kind === 'pinch' && e.touches.length === 2) {
        const distance = touchDistance(e.touches)
        const mid = touchMidpoint(e.touches)
        const at = clientToSvgPoint(mid.x, mid.y)
        if (at) setView(v => zoomAt(v, at, distance / state.lastDistance))
        touchRef.current = { kind: 'pinch', lastDistance: distance }
      }
    }

    // Dropping to one finger mid-pinch resumes as a pan instead of stopping;
    // dropping to zero clears state entirely.
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchRef.current = { kind: 'pan', lastClientX: e.touches[0].clientX, lastClientY: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        touchRef.current = { kind: 'pinch', lastDistance: touchDistance(e.touches) }
      } else {
        touchRef.current = null
      }
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('touchstart', onTouchStart, { passive: false })
    svg.addEventListener('touchmove', onTouchMove, { passive: false })
    svg.addEventListener('touchend', onTouchEnd, { passive: false })
    svg.addEventListener('touchcancel', onTouchEnd, { passive: false })
    return () => {
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('touchstart', onTouchStart)
      svg.removeEventListener('touchmove', onTouchMove)
      svg.removeEventListener('touchend', onTouchEnd)
      svg.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [paths])

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl p-4 w-[92vw] h-[88vh] max-w-5xl flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-bold">{column.label}の地図</h3>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 select-none ml-auto">
            <input type="checkbox" checked={showBorders} onChange={e => setShowBorders(e.target.checked)} />
            境界線
          </label>
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="relative flex-1 min-h-0 touch-none" ref={mapAreaRef}>
          {!paths ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">読み込み中…</div>
          ) : (
            <svg
              ref={svgRef}
              data-testid="map-svg"
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className={`w-full h-full touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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

          {barRect && (
            <div
              data-testid="map-histogram-panel"
              className="absolute bottom-0 z-10 overflow-hidden rounded-t bg-white/90 shadow-[0_-1px_4px_rgba(0,0,0,0.15)] transition-[height] duration-200 ease-out"
              style={{ left: barRect.left, width: barRect.width, height: showHistogram ? 140 : 0 }}
            >
              <span className="absolute top-0.5 left-1 text-[9px] text-gray-400 pointer-events-none">
                {maxCount.toLocaleString('ja-JP')}件
              </span>
              <svg data-testid="map-histogram" viewBox="0 0 400 200" preserveAspectRatio="none" className="w-full h-full">
                <line x1={0} y1={190} x2={400} y2={190} stroke="#e5e7eb" strokeWidth={1} />
                {bins.map((bin, i) => {
                  const ramp = COLOR_SCHEMES[schemeKey].ramp
                  const fill = sequentialColor(max === min ? 0.5 : ((bin.x0 + bin.x1) / 2 - min) / (max - min), ramp)
                  const barWidth = 400 / BIN_COUNT
                  const barHeight = (bin.count / maxCount) * 178
                  return (
                    <rect
                      key={i}
                      x={i * barWidth + 1}
                      y={190 - barHeight}
                      width={Math.max(0, barWidth - 2)}
                      height={barHeight}
                      rx={1}
                      fill={bin.count === 0 ? '#f3f2ef' : fill}
                      onMouseMove={e => setBarHover({ x: e.clientX, y: e.clientY, x0: bin.x0, x1: bin.x1, count: bin.count })}
                      onMouseLeave={() => setBarHover(null)}
                    />
                  )
                })}
              </svg>
            </div>
          )}
          {showHistogram && barHover && (
            <div
              data-testid="histogram-tooltip"
              className="fixed pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
              style={{ left: barHover.x + 12, top: barHover.y + 12 }}
            >
              {barHover.x0.toLocaleString('ja-JP')} 〜 {barHover.x1.toLocaleString('ja-JP')}: {barHover.count.toLocaleString('ja-JP')}件
            </div>
          )}

          {paths && (
            <button
              className="absolute bottom-3 right-3 z-20 px-3 py-1 border border-gray-300 rounded bg-white/90 hover:bg-gray-50 text-sm shadow-sm"
              onClick={() => setShowHistogram(h => !h)}
            >
              {showHistogram ? 'ヒストグラムを閉じる' : 'ヒストグラムを見る'}
            </button>
          )}
        </div>

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
              ref={gradientRef}
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
      </div>
    </div>
  )
}

export default MapModal
