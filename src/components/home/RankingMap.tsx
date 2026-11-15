import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMunicipalityPaths, sequentialColor, COLOR_SCHEMES, DIVERGING_RAMP, VIEW_SIZE, type MuniPaths } from '@/lib/topoMap'
import { makeScale, isSigned } from '@/lib/colorScale'

type Props = {
  // municipality code → its value in the ranking's mapped column
  values: Map<string, number>
  // designated-city ward code → its city's code (wards are drawn, cities not)
  parentOf: Map<string, string>
  nameOf: (code: string) => string
  format: (v: number) => string
  // Where the whole map leads: the ranking's own map view.
  to: string
  label: string
}

const NO_DATA_FILL = '#e1e0d9'

// A ranking drawn as a still map: the same automatic scale and colors as the
// ranking's map view (MapView) that it links to, so clicking it opens the
// same picture, now explorable.
function RankingMap({ values, parentOf, nameOf, format, to, label }: Props) {
  const [paths, setPaths] = useState<MuniPaths | null>(null)
  useEffect(() => { fetchMunicipalityPaths().then(setPaths) }, [])

  const scale = useMemo(() => {
    const list = [...values.values()].filter(v => !Number.isNaN(v))
    return list.length ? makeScale(list, 'auto') : null
  }, [values])
  const signed = !!scale && isSigned(scale.kind)
  const ramp = signed ? DIVERGING_RAMP : COLOR_SCHEMES.blue.ramp
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

  return (
    <figure className="m-0">
      <Link
        to={to}
        className="group relative block rounded-xl bg-[#f7f7f5] outline-offset-2 hover:outline-2 hover:outline-[#c9a227] focus-visible:outline-2 focus-visible:outline-[#c9a227]"
        aria-label={`${label}（地図で見る）`}
      >
        {drawn ? (
          <svg viewBox={box} className="block w-full h-auto max-h-[70vh]" aria-hidden="true">
            <g ref={groupRef}>
              {[...paths.entries()].map(([code, d]) => {
                const own = values.has(code) ? code : (parentOf.get(code) ?? code)
                const v = values.get(own)
                return (
                  <path
                    key={code}
                    d={d}
                    fill={v === undefined || Number.isNaN(v) ? NO_DATA_FILL : sequentialColor(scale.t(v), ramp)}
                    stroke="#ffffff"
                    strokeWidth={0.3}
                  >
                    {v !== undefined && <title>{`${nameOf(own)} ${format(v)}`}</title>}
                  </path>
                )
              })}
            </g>
          </svg>
        ) : (
          <div className="w-full aspect-[6/5] flex items-center justify-center text-xs text-gray-400">地図を読み込み中…</div>
        )}
        <span className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#13294b] shadow-sm group-hover:bg-white">
          地図で見る →
        </span>
      </Link>
      {scale && (
        <figcaption className="mt-2 max-w-xs text-[11px] text-gray-500">
          <div className="h-2 rounded-sm" style={{ background: `linear-gradient(to right, ${ramp.join(', ')})` }} aria-hidden="true" />
          <div className="relative mt-0.5 h-4 tabular-nums">
            <span className="absolute left-0">{format(scale.lo)}</span>
            {signed && <span className="absolute -translate-x-1/2" style={{ left: `${scale.t(0) * 100}%` }}>0</span>}
            <span className="absolute right-0">{format(scale.hi)}</span>
          </div>
        </figcaption>
      )}
    </figure>
  )
}

export default RankingMap
