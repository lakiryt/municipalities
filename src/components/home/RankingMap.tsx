import { Link } from 'react-router-dom'

type Props = {
  // The prerendered map (scripts/prerender-featured.mjs); undefined while loading.
  src?: string
  legend?: { lo: number; hi: number; zeroAt: number | null; ramp: readonly string[] }
  format: (v: number) => string
  // Where the whole map leads: the ranking's own map view.
  to: string
  label: string
  // width ÷ height, so the frame keeps its size while the image loads
  aspect: number
  // Load now, rather than when the browser sees it coming near.
  eager: boolean
}

// A ranking drawn as a still map, in the same automatic scale and colors as
// the ranking's map view (MapView) that it links to — so clicking it opens
// the same picture, now explorable. No borders, as in the map view.
function RankingMap({ src, legend, format, to, label, aspect, eager }: Props) {
  return (
    <figure className="m-0">
      <Link
        to={to}
        className="group relative block rounded-xl bg-[#f7f7f5] outline-offset-2 hover:outline-2 hover:outline-gold focus-visible:outline-2 focus-visible:outline-gold"
        aria-label={`${label}（地図で見る）`}
      >
        <div className="w-full" style={{ aspectRatio: aspect }}>
          {src && <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" className="block w-full h-full" />}
        </div>
        <span className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-navy-900 shadow-sm group-hover:bg-white">
          地図で見る →
        </span>
      </Link>
      {legend && (
        <figcaption className="mt-2 max-w-xs text-[11px] text-gray-500">
          <div className="h-2 rounded-sm" style={{ background: `linear-gradient(to right, ${legend.ramp.join(', ')})` }} aria-hidden="true" />
          <div className="relative mt-0.5 h-4 tabular-nums">
            <span className="absolute left-0">{format(legend.lo)}</span>
            {legend.zeroAt !== null && <span className="absolute -translate-x-1/2" style={{ left: `${legend.zeroAt * 100}%` }}>0</span>}
            <span className="absolute right-0">{format(legend.hi)}</span>
          </div>
        </figcaption>
      )}
    </figure>
  )
}

export default RankingMap
