import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMunicipalityPaths, sequentialColor, DIVERGING_RAMP, VIEW_SIZE, type MuniPaths } from '@/lib/topoMap'
import { makeScale } from '@/lib/colorScale'
import { formatRate } from '@/lib/changeScale'

type Props = {
  // municipality code → change rate in percent (official municipalities only)
  rates: Map<string, number>
  // designated-city ward code → its city's code (wards are drawn, cities not)
  parentOf: Map<string, string>
  nameOf: (code: string) => string
  // Where the whole map leads: the ranking's own map view.
  to: string
  caption: string
}

const NO_DATA_FILL = '#e1e0d9'

// The home page's map: every municipality colored by its population change,
// on the same scale and colors as the ranking's map view it links to — so
// clicking it opens the same picture, now explorable.
function ChangeMap({ rates, parentOf, nameOf, to, caption }: Props) {
  const [paths, setPaths] = useState<MuniPaths | null>(null)
  useEffect(() => { fetchMunicipalityPaths().then(setPaths) }, [])

  const scale = useMemo(() => {
    const values = [...rates.values()].filter(v => !Number.isNaN(v))
    return values.length ? makeScale(values, 'auto') : null
  }, [rates])

  const drawn = !!paths && !!scale

  // Frame the drawn land itself (the shapes sit in a square with sea around).
  const groupRef = useRef<SVGGElement>(null)
  const [box, setBox] = useState(`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`)
  useLayoutEffect(() => {
    const b = groupRef.current?.getBBox()
    if (b && b.width > 0) {
      const pad = 8
      setBox(`${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`)
    }
  }, [drawn])

  // Each drawn shape → the municipality whose value it shows.
  const owner = (code: string) => parentOf.get(code) ?? code

  const legend = scale && [scale.lo, 0, scale.hi]

  return (
    <figure className="m-0">
      <Link
        to={to}
        className="group relative block rounded-xl bg-[#f7f7f5] outline-offset-2 hover:outline-2 hover:outline-[#c9a227] focus-visible:outline-2 focus-visible:outline-[#c9a227]"
        aria-label={`${caption}（地図で見る）`}
      >
        {paths && scale ? (
          <svg viewBox={box} className="block w-full h-auto max-h-[75vh]" aria-hidden="true">
            <g ref={groupRef}>
            {[...paths.entries()].map(([code, d]) => {
              const own = owner(code)
              const v = rates.get(own)
              return (
                <path
                  key={code}
                  d={d}
                  fill={v === undefined || Number.isNaN(v) ? NO_DATA_FILL : sequentialColor(scale.t(v), DIVERGING_RAMP)}
                  stroke="#ffffff"
                  strokeWidth={0.3}
                >
                  <title>{`${nameOf(own)} ${formatRate(v ?? NaN)}`}</title>
                </path>
              )
            })}
            </g>
          </svg>
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-xs text-gray-400">地図を読み込み中…</div>
        )}
        <span className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#13294b] shadow-sm group-hover:bg-white">
          地図で見る →
        </span>
      </Link>
      <figcaption className="mt-3 text-xs text-gray-600">
        <div>{caption}</div>
        {legend && (
          <div className="mt-1.5 max-w-xs">
            <div
              className="h-2 rounded-sm"
              style={{ background: `linear-gradient(to right, ${DIVERGING_RAMP.join(', ')})` }}
              aria-hidden="true"
            />
            <div className="relative mt-0.5 h-4 tabular-nums text-[11px] text-gray-500">
              <span className="absolute left-0">{formatRate(legend[0])}</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${scale.t(0) * 100}%` }}>0%</span>
              <span className="absolute right-0">{formatRate(legend[2])}</span>
            </div>
          </div>
        )}
      </figcaption>
    </figure>
  )
}

export default ChangeMap
