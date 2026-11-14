import { Link } from 'react-router-dom'
import { PREF_TILES, TILE_COLS, TILE_ROWS, shortPrefName } from '@/data/prefTiles'
import { CHANGE_CLASSES, NO_DATA, changeClass, formatRate } from '@/lib/changeScale'
import { prefectures } from '@/data/datasets'

type Props = {
  // prefecture code (2 digits) → change rate in percent
  rates: Map<string, number>
  linkFor: (romanized: string) => string
  caption: string
}

// The home page's map: one tile per prefecture, colored by its population
// change, each a link to that prefecture's page. Every tile prints its name
// and value, so the colors are never the only way to read it.
function PrefTileMap({ rates, linkFor, caption }: Props) {
  return (
    <figure className="m-0">
      <div
        className="grid gap-[3px] w-full"
        style={{ gridTemplateColumns: `repeat(${TILE_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${TILE_ROWS}, auto)` }}
        role="list"
        aria-label={caption}
      >
        {prefectures.map(p => {
          const code = p.code.slice(0, 2)
          const [col, row] = PREF_TILES[code]
          const rate = rates.get(code) ?? NaN
          const cls = changeClass(rate)
          const { fill, ink } = cls ?? NO_DATA
          return (
            <Link
              key={code}
              role="listitem"
              to={linkFor(p.romanized)}
              title={`${p.kanji} ${formatRate(rate)}`}
              aria-label={`${p.kanji} ${formatRate(rate)}`}
              className="aspect-square rounded-[3px] sm:rounded-md flex flex-col items-center justify-center leading-none hover:outline-2 hover:outline-[#c9a227] focus-visible:outline-2 focus-visible:outline-[#c9a227] transition-[outline]"
              style={{ gridColumn: col + 1, gridRow: row + 1, background: fill, color: ink }}
            >
              <span className="text-[8px] sm:text-[11px] font-semibold whitespace-nowrap">{shortPrefName(p.kanji)}</span>
              <span className="hidden sm:block mt-0.5 text-[10px] tabular-nums opacity-90">{formatRate(rate)}</span>
            </Link>
          )
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        <span>{caption}</span>
        {CHANGE_CLASSES.map(c => (
          <span key={c.label} className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.fill }} />
            {c.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

export default PrefTileMap
