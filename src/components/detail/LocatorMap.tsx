import { useEffect, useRef, useState } from 'react'
import { fetchMunicipalityPaths, VIEW_SIZE, type MuniPaths } from '@/lib/topoMap'
import { fitBounds, type Box } from '@/lib/mapFit'
import { CHART } from './chartStyle'

type Props = {
  // The municipality's own shapes: its code, or a designated city's wards
  // (the city itself has no shape of its own).
  targets: string[]
  label: string
  neighbors: string[]
  nameOf: (code: string) => string
  onSelect: (code: string) => void
}

const FILL = { target: CHART.series1, neighbor: '#9ec5f4', other: '#ecebe7' }

// Where the municipality is: framed on it and its neighbors, the
// municipality in the series blue, neighbors in a light step of the same
// hue (clickable — they lead to their own pages), everything else gray.
function LocatorMap({ targets, label, neighbors, nameOf, onSelect }: Props) {
  const [paths, setPaths] = useState<MuniPaths | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => { fetchMunicipalityPaths().then(setPaths) }, [])

  const focus = [...targets, ...neighbors].join()
  useEffect(() => {
    const svg = svgRef.current
    if (!paths || !svg) return
    const frame = requestAnimationFrame(() => {
      const wanted = new Set(focus.split(','))
      const boxes: Box[] = []
      svg.querySelectorAll<SVGPathElement>('path[data-code]').forEach(el => {
        if (!wanted.has(el.dataset.code!)) return
        const b = el.getBBox()
        boxes.push({ x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height })
      })
      const fit = fitBounds(boxes)
      if (!fit) return
      const sc = Math.min(60, Math.max(1, 0.8 * VIEW_SIZE / Math.max(fit.x1 - fit.x0, fit.y1 - fit.y0, 4)))
      setView({ scale: sc, x: VIEW_SIZE / 2 - sc * (fit.x0 + fit.x1) / 2, y: VIEW_SIZE / 2 - sc * (fit.y0 + fit.y1) / 2 })
    })
    return () => cancelAnimationFrame(frame)
  }, [paths, focus])

  if (!paths) return <div className="aspect-square max-h-80 w-full bg-gray-50 rounded flex items-center justify-center text-xs text-gray-400">地図を読み込み中…</div>
  const neighborSet = new Set(neighbors)
  const targetSet = new Set(targets)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full max-h-80 aspect-square bg-[#f7f7f5] rounded" role="img" aria-label={`${label}の位置と隣接自治体`}>
      <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
        {[...paths.entries()].map(([c, d]) => {
          const isTarget = targetSet.has(c), isNeighbor = neighborSet.has(c)
          return (
            <path
              key={c}
              data-code={c}
              d={d}
              fill={isTarget ? FILL.target : isNeighbor ? FILL.neighbor : FILL.other}
              stroke="#ffffff"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
              className={isNeighbor ? 'cursor-pointer hover:opacity-80' : undefined}
              onClick={isNeighbor ? () => onSelect(c) : undefined}
            >
              {(isTarget || isNeighbor) && <title>{nameOf(c)}</title>}
            </path>
          )
        })}
      </g>
    </svg>
  )
}

export default LocatorMap
