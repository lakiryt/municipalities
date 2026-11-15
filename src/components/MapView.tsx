import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem } from '@/data/municipalities'
import type { DesignationSets } from '@/data/datasets'
import type { ColumnState, ColumnRef } from '@/types'
import { formatValue } from '@/lib/format'
import { fitBounds, type Box } from '@/lib/mapFit'
import {
  makeScale, canLog, canDiverge, suggestScale, isSigned, asFinite, rampPosition, SCALE_LABELS, type ScaleChoice, type Finite,
} from '@/lib/colorScale'
import {
  fetchMunicipalityPaths, sequentialColor, COLOR_SCHEMES, DIVERGING_RAMP, VIEW_SIZE,
  type MuniPaths, type ColorSchemeKey,
} from '@/lib/topoMap'

type Props = {
  column: ColumnState
  // Numeric columns the map can be colored by (the switcher's options).
  columnOptions: ColumnRef[]
  onSelectColumn: (id: number) => void
  displayItems: BaseItem[]
  // Every row, shown or not: names any shape on hover, and tells which wards
  // belong to a designated city (which has no shape of its own).
  allItems?: BaseItem[]
  designations: DesignationSets | undefined
  coastal: Set<string>
  // When the rows are filtered (e.g. to one prefecture), zoom to them.
  fitToItems?: boolean
  linkFor?: (code: string) => string
}

// Legend values are scale positions, not data: 3 significant figures
// (13,988.7664 → 13,989; 4.4152 → 4.42).
const legendValue = (v: number) =>
  formatValue(Number(v.toPrecision(Math.max(3, Math.floor(Math.log10(Math.abs(v) || 1)) + 1))))

type Picked = { code: string; label: string; pref: string; value: number | undefined }

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

// The map view: fills the content area below the toolbar (not a modal), so
// "表 ｜ 地図" switches between two views of the same rows. Desktop hovers
// for a tooltip; a click/tap pins a card (phones have no hover).
function MapView({ column, columnOptions, onSelectColumn, displayItems, allItems = [], designations, coastal, fitToItems = false, linkFor }: Props) {
  // The color scale and outlier clipping (a percentage, 0 = none) are per
  // map and kept in the URL (?scale=log&clip=2), like the map column itself.
  const [searchParams, setSearchParams] = useSearchParams()
  const scaleParam = searchParams.get('scale')
  const scaleChoice: ScaleChoice =
    scaleParam === 'linear' || scaleParam === 'log' || scaleParam === 'rank' || scaleParam === 'diverging' || scaleParam === 'symlog'
      ? scaleParam : 'auto'
  const clipParam = Number(searchParams.get('clip') ?? 0)
  const clipPercent = clipParam >= 0 && clipParam <= 49 ? clipParam : 0
  // The input's own text, so it can be briefly empty or mid-edit.
  const [clipText, setClipText] = useState(String(clipPercent))
  const setParam = (key: string, value: string | null) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (value === null) next.delete(key); else next.set(key, value)
    return next
  }, { replace: true })

  const [paths, setPaths] = useState<MuniPaths | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: number | undefined } | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  // A drag that ends over a municipality still fires a click — remember how
  // far the pointer moved so a pan doesn't also pick.
  const movedRef = useRef(0)
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [schemeKey, setSchemeKey] = useState<ColorSchemeKey>('blue')
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
      movedRef.current = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY)
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

  const allByCode = useMemo(() => new Map(allItems.map(i => [i.code, i])), [allItems])
  const wardsOf = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const i of allItems) if (i.parent) m.set(i.parent, [...(m.get(i.parent) ?? []), i.code])
    return m
  }, [allItems])

  // Which row each shape shows: its own, or — for a designated city shown
  // without its wards (e.g. filtered by &official) — the city's, so the
  // city is drawn over its wards' shapes. A ward shown itself wins.
  const owner = useMemo(() => {
    const m = new Map<string, string>()
    if (!paths) return m
    for (const code of itemByCode.keys()) if (paths.has(code)) m.set(code, code)
    for (const code of itemByCode.keys()) {
      if (paths.has(code)) continue
      for (const w of wardsOf.get(code) ?? []) if (paths.has(w) && !m.has(w)) m.set(w, code)
    }
    return m
  }, [paths, itemByCode, wardsOf])
  const drawn = useMemo(() => new Set(owner.values()), [owner])

  // One value per shown row (a city drawn over its wards counts once).
  const values = useMemo(() => {
    if (!paths) return new Map<string, Finite>()
    const map = new Map<string, Finite>()
    for (const [code, item] of itemByCode) {
      // Codes without a drawn path would otherwise skew the color scale
      // toward values that never appear on the map itself. Prefecture-level
      // totals (code ending "000") are excluded outright too — a handful of
      // small islands are drawn under their prefecture's own code rather
      // than a municipality's, and coloring them by the prefecture's total
      // would be just as misleading as including the total itself.
      if (!drawn.has(code) || code.endsWith('000')) continue
      // NaN (missing) and ±∞ (a ratio over a zero, e.g. no men of an age in a
      // small village) have no place on a color scale: drawn as no data.
      const v = asFinite(evaluate(column.typed, baseItemEnv(item, designations, coastal)) as number)
      if (v !== undefined) map.set(code, v)
    }
    return map
  }, [itemByCode, column, designations, coastal, paths, drawn])

  const valueList = useMemo(() => [...values.values()], [values])
  const logPossible = useMemo(() => canLog(valueList), [valueList])
  const divergePossible = useMemo(() => canDiverge(valueList), [valueList])
  const autoKind = useMemo(() => suggestScale(valueList), [valueList])
  // null: no value in this column can be drawn — every shape is "no data".
  const scale = useMemo(() => makeScale(valueList, scaleChoice, clipPercent), [valueList, scaleChoice, clipPercent])
  const diverging = scale !== null && isSigned(scale.kind)
  const ramp = diverging ? DIVERGING_RAMP : COLOR_SCHEMES[schemeKey].ramp

  // Bins are equal steps along the color scale (not the raw values), so a
  // bar's horizontal position lines up with its color on the legend below —
  // on a log scale each bar covers the same ratio, not the same difference.
  const BIN_COUNT = 20
  const bins = useMemo(() => {
    if (!scale) return []
    const counts = new Array(BIN_COUNT).fill(0)
    for (const v of valueList) counts[Math.min(BIN_COUNT - 1, Math.floor(scale.t(v) * BIN_COUNT))]++
    return counts.map((count, i) => ({
      x0: scale.valueAt(rampPosition(i / BIN_COUNT)), x1: scale.valueAt(rampPosition((i + 1) / BIN_COUNT)), count,
    }))
  }, [valueList, scale])

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
  }, [scale, schemeKey])

  // Zoom to the filtered rows (one prefecture, say): the union of their
  // shapes' bounding boxes, in the map's own coordinates. Only when the
  // filtered set changes — panning/zooming afterwards is left alone.
  const fitKey = fitToItems ? [...itemByCode.keys()].join() : ''
  useEffect(() => {
    const svg = svgRef.current
    if (!paths || !svg) return
    // Measured after the shapes are laid out (next frame), then applied.
    const frame = requestAnimationFrame(() => {
      // Nothing filtered — or a filter that keeps (nearly) every shape —
      // shows the whole country rather than zooming to it.
      if (!fitKey || owner.size >= 0.9 * paths.size) { setView({ scale: 1, x: 0, y: 0 }); return }
      // One box per municipality (a municipality may be several paths).
      const boxes = new Map<string, Box>()
      svg.querySelectorAll<SVGPathElement>('path[data-code]').forEach(el => {
        const code = el.dataset.code!
        if (!owner.has(code)) return
        const bb = el.getBBox()
        const prev = boxes.get(code)
        boxes.set(code, prev
          ? { x0: Math.min(prev.x0, bb.x), y0: Math.min(prev.y0, bb.y), x1: Math.max(prev.x1, bb.x + bb.width), y1: Math.max(prev.y1, bb.y + bb.height) }
          : { x0: bb.x, y0: bb.y, x1: bb.x + bb.width, y1: bb.y + bb.height })
      })
      const fit = fitBounds([...boxes.values()])
      if (!fit) return
      const sc = Math.min(MAX_SCALE, Math.max(MIN_SCALE, 0.9 * VIEW_SIZE / Math.max(fit.x1 - fit.x0, fit.y1 - fit.y0)))
      setView({ scale: sc, x: VIEW_SIZE / 2 - sc * (fit.x0 + fit.x1) / 2, y: VIEW_SIZE / 2 - sc * (fit.y0 + fit.y1) / 2 })
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, fitKey])

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
    movedRef.current = 0
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

  const pick = (shape: string) => {
    if (movedRef.current > 5) return
    const code = owner.get(shape) ?? shape
    // A shape outside the shown rows still says what it is (データなし).
    const item = itemByCode.get(code) ?? allByCode.get(code)
    if (!item) { setPicked(null); return }
    setPicked({ code, label: item.kanji || item.prefecture.kanji || '', pref: item.kanji ? item.prefecture.kanji ?? '' : '', value: values.get(code) })
  }

  return (
    <div className="h-full w-full max-w-5xl mx-auto px-3 pb-3 flex flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <h2 className="text-sm font-semibold">{column.label}の地図</h2>
          {columnOptions.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
              色分けする列
              <select
                aria-label="色分けする列"
                className="border border-gray-300 rounded px-1.5 py-1 text-sm text-gray-900 bg-white max-w-[55vw]"
                value={column.id}
                onChange={e => { setPicked(null); onSelectColumn(Number(e.target.value)) }}
              >
                {columnOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          )}
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
                {[...paths.entries()].map(([shape, d]) => {
                  const code = owner.get(shape) ?? shape
                  const v = values.get(code)
                  const fill = v === undefined || !scale ? NO_DATA_FILL : sequentialColor(scale.t(v), ramp)
                  return (
                    <path
                      key={shape}
                      data-code={shape}
                      d={d}
                      fill={fill}
                      strokeWidth={picked?.code === code ? 1.5 : 0.5}
                      vectorEffect="non-scaling-stroke"
                      onMouseMove={e => {
                        if (isDragging) return
                        const item = itemByCode.get(code) ?? allByCode.get(code)
                        if (!item) { setHover(null); return }
                        // Prefecture-level codes (the remote islands drawn under
                        // them) have no municipality name of their own in the
                        // CSV — fall back to the prefecture's name instead of
                        // showing a blank label.
                        const label = item.kanji || item.prefecture.kanji || ''
                        setHover({ x: e.clientX, y: e.clientY, label, value: v })
                      }}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => pick(shape)}
                      stroke={picked?.code === code ? '#111827' : 'none'}
                    />
                  )
                })}
              </g>
            </svg>
          )}
          {picked && (
            <div
              data-testid="map-picked"
              className="absolute top-2 left-2 z-20 bg-white/95 border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm max-w-[70%]"
            >
              <div className="flex items-start gap-3">
                <div>
                  <div className="font-semibold">{picked.label}<span className="ml-1.5 text-xs text-gray-400 font-normal">{picked.pref}</span></div>
                  <div className="text-gray-600 tabular-nums">
                    {column.label}: {picked.value !== undefined ? formatValue(picked.value) : 'データなし'}
                  </div>
                  {linkFor && picked.pref && <Link to={linkFor(picked.code)} className="text-xs text-blue-600 hover:underline">詳細を見る →</Link>}
                </div>
                <button aria-label="閉じる" className="text-gray-400 hover:text-gray-700 leading-none" onClick={() => setPicked(null)}>✕</button>
              </div>
            </div>
          )}
          {hover && (
            <div
              data-testid="map-tooltip"
              className="fixed pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 z-50"
              style={{ left: hover.x + 12, top: hover.y + 12 }}
            >
              {hover.value !== undefined ? `${hover.label}: ${formatValue(hover.value)}` : `${hover.label}: データなし`}
            </div>
          )}

          {barRect && (
            <div
              data-testid="map-histogram-panel"
              className="absolute bottom-0 z-10 overflow-hidden rounded-t bg-white/90 shadow-[0_-1px_4px_rgba(0,0,0,0.15)] transition-[height] duration-200 ease-out"
              style={{ left: barRect.left, width: barRect.width, height: showHistogram ? 140 : 0 }}
            >
              <svg data-testid="map-histogram" viewBox="0 0 400 200" preserveAspectRatio="none" className="w-full h-full">
                <line x1={0} y1={190} x2={400} y2={190} stroke="#e5e7eb" strokeWidth={1} />
                {bins.map((bin, i) => {
                  const fill = sequentialColor(rampPosition((i + 0.5) / BIN_COUNT), ramp)
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

          {paths && scale && scale.kind !== 'rank' && (
            // On a rank scale every bar would be the same height — no histogram.
            <button
              className="absolute bottom-3 right-3 z-20 px-3 py-1 border border-gray-300 rounded bg-white/90 hover:bg-gray-50 text-sm shadow-sm"
              onClick={() => setShowHistogram(h => !h)}
            >
              {showHistogram ? 'ヒストグラムを閉じる' : 'ヒストグラムを見る'}
            </button>
          )}
        </div>

        {!scale ? (
          <p className="mt-3 text-xs text-gray-500" data-testid="map-legend">この列には地図に塗れる値がありません</p>
        ) : (<>
        <div className="relative mt-3" ref={schemeRef}>
          <button
            type="button"
            data-testid="map-legend"
            aria-label="配色"
            aria-haspopup="listbox"
            aria-expanded={schemeOpen}
            title={diverging ? '増減の配色（0が中央。減少は赤系、増加は青系）' : COLOR_SCHEMES[schemeKey].label}
            disabled={diverging}
            className="flex items-center gap-2 w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-500 cursor-pointer shadow-sm hover:border-gray-400 disabled:cursor-default disabled:hover:border-gray-300"
            onClick={() => setSchemeOpen(o => !o)}
          >
            <span className="tabular-nums">{scale.clippedLow ? '≤ ' : ''}{legendValue(scale.lo)}</span>
            <span
              ref={gradientRef}
              className="h-2 flex-1 rounded-sm block"
              style={{ background: `linear-gradient(to right, ${ramp.join(', ')})` }}
            />
            <span className="tabular-nums">{scale.clippedHigh ? '≥ ' : ''}{legendValue(scale.hi)}</span>
            {!diverging && <span className="text-gray-400">▾</span>}
          </button>
          {schemeOpen && !diverging && (
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
          <label className="flex items-center gap-1.5">
            目盛り
            <select
              aria-label="目盛り"
              className="border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-900"
              value={scaleChoice}
              onChange={e => setParam('scale', e.target.value === 'auto' ? null : e.target.value)}
            >
              <option value="auto">自動（{SCALE_LABELS[autoKind]}）</option>
              <option value="linear">線形</option>
              <option value="log" disabled={!logPossible}>対数{logPossible ? '' : '（0以下の値が多いため不可）'}</option>
              <option value="rank">順位（パーセンタイル）</option>
              <option value="diverging" disabled={!divergePossible}>{SCALE_LABELS.diverging}{divergePossible ? '' : '（正と負の値がないため不可）'}</option>
              <option value="symlog" disabled={!divergePossible}>{SCALE_LABELS.symlog}{divergePossible ? '' : '（正と負の値がないため不可）'}</option>
            </select>
          </label>
          <label className={`flex items-center gap-1.5 ${scale.kind === 'rank' ? 'opacity-40' : ''}`} title="上下それぞれ指定した割合の値を色の範囲から外し、両端の色で塗ります（0 で外さない）">
            外れ値を除く 上下
            <input
              type="number"
              aria-label="外れ値として除く割合（%）"
              min={0}
              max={49}
              step={0.5}
              className="w-14 border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-900 tabular-nums disabled:bg-gray-50"
              value={clipText}
              disabled={scale.kind === 'rank'}
              onChange={e => {
                setClipText(e.target.value)
                const v = Number(e.target.value)
                if (e.target.value !== '' && v >= 0 && v <= 49) setParam('clip', v > 0 ? String(v) : null)
              }}
            />
            %
          </label>
          {scale.kind !== 'linear' && (
            <span className="text-gray-400 tabular-nums">中央の色 ≒ {legendValue(scale.valueAt(rampPosition(0.5)))}</span>
          )}
        </div>
        </>)}
    </div>
  )
}

export default MapView
