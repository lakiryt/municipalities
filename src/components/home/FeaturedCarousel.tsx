import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseAndTypeCheck } from '@/lang/expr'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem } from '@/data/municipalities'
import { defaultDataSelection, type DesignationSets } from '@/data/datasets'
import { useMunicipalityData } from '@/data/useMunicipalityData'
import { formatValue } from '@/lib/format'
import { featuredRankings, type Featured } from '@/rankings/featured'
import RankingMap from './RankingMap'

const NAVY = '#13294b'
const TOP = 5

type Row = { item: BaseItem; value: number }

// One ranking, worked out the way its page would: the starting filter, the
// map column's values, and the first rows in the ranking's own order.
function evaluateFeatured(f: Featured, items: BaseItem[], designations: DesignationSets | undefined, coastal: Set<string>) {
  const column = f.config.columns.find(c => c.id === f.mapColumn)!
  const value = parseAndTypeCheck(column.expression)
  const filter = f.config.filterExpression ? parseAndTypeCheck(f.config.filterExpression) : null
  const sort = parseAndTypeCheck(f.config.sortExpression)
  const sign = f.config.sortDirection === 'desc' ? -1 : 1

  const values = new Map<string, number>()
  const ranked: { row: Row; key: number }[] = []
  for (const item of items) {
    const env = baseItemEnv(item, designations, coastal)
    if (filter && evaluate(filter, env) !== true) continue
    const v = evaluate(value, env) as number
    if (Number.isNaN(v)) continue
    values.set(item.code, v)
    const key = evaluate(sort, env) as number
    if (!Number.isNaN(key)) ranked.push({ row: { item, value: v }, key })
  }
  ranked.sort((a, b) => sign * (a.key - b.key))
  return { values, top: ranked.slice(0, TOP).map(r => r.row) }
}

function Slide({ f, index, count, items, designations, coastal, show }: {
  f: Featured; index: number; count: number; items: BaseItem[]; designations: DesignationSets | undefined; coastal: Set<string>; show: boolean
}) {
  const { values, top } = useMemo(
    () => (show && items.length ? evaluateFeatured(f, items, designations, coastal) : { values: new Map<string, number>(), top: [] }),
    [show, f, items, designations, coastal]
  )
  const byCode = useMemo(() => new Map(items.map(i => [i.code, i])), [items])
  const parentOf = useMemo(() => new Map(items.filter(i => i.parent).map(i => [i.code, i.parent])), [items])
  const format = (v: number) => `${formatValue(v)}${f.unit}`

  return (
    <div
      className="w-full shrink-0 snap-start px-px"
      role="group"
      aria-roledescription="スライド"
      aria-label={`${index + 1} / ${count}: ${f.question}`}
    >
      <h3 className="text-xl md:text-2xl font-bold leading-snug" style={{ color: NAVY }}>{f.question}</h3>
      <p className="mt-1 text-sm text-gray-600">{f.note}</p>
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start">
        {show && values.size > 0 ? (
          <RankingMap
            values={values}
            parentOf={parentOf}
            nameOf={c => byCode.get(c)?.kanji ?? c}
            format={format}
            to={`${f.path}?map=@${f.mapColumn}`}
            label={f.question}
          />
        ) : (
          <div className="w-full aspect-[6/5] rounded-xl bg-[#f7f7f5] flex items-center justify-center text-xs text-gray-400">読み込み中…</div>
        )}
        <div>
          <ol className="divide-y divide-gray-100">
            {top.map(({ item, value }, i) => (
              <li key={item.code} className="flex items-baseline gap-2 py-1.5 text-sm">
                <span className="w-4 text-right text-xs text-gray-400 tabular-nums">{i + 1}</span>
                <Link to={`/m/${item.code}`} className="font-medium text-[#13294b] hover:underline">{item.kanji}</Link>
                <span className="text-xs text-gray-500">{item.prefecture.kanji}</span>
                <span className="ml-auto tabular-nums font-semibold">{format(value)}</span>
              </li>
            ))}
          </ol>
          <Link
            to={f.path}
            className="mt-3 flex items-center rounded-lg border border-[#c9d6ea] bg-[#f4f7fb] px-3 py-2 text-sm font-medium text-[#13294b] hover:border-[#4a6fa5] hover:bg-[#e3ecf8]"
          >
            ランキングを見る<span className="ml-auto text-gray-400" aria-hidden="true">›</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// The home page's picks, one ranking per slide: ‹ › (or a swipe) moves
// between them. A slide's map is drawn once it's been near the screen.
function FeaturedCarousel() {
  const featured = useMemo(() => featuredRankings(), [])
  const { items, designations, coastal } = useMunicipalityData(defaultDataSelection(), true)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState(() => new Set([0, 1]))

  const go = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const next = (i + featured.length) % featured.length
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const i = Math.round(track.scrollLeft / track.clientWidth)
    if (i === active) return
    setActive(i)
    if (!seen.has(i + 1) || !seen.has(i)) setSeen(s => new Set([...s, i, i + 1]))
  }

  const arrow = 'h-9 w-9 shrink-0 rounded-full border border-gray-200 bg-white text-lg leading-none text-[#13294b] hover:border-[#4a6fa5] hover:bg-[#f4f7fb]'
  return (
    <section className="max-w-5xl mx-auto px-4 py-8" aria-roledescription="カルーセル" aria-label="ピックアップ">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label="スライドを選ぶ">
          {featured.map((f, i) => (
            <button
              key={f.path}
              role="tab"
              aria-selected={i === active}
              aria-label={f.question}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-[#13294b]' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
            />
          ))}
        </div>
        <span className="ml-auto text-xs tabular-nums text-gray-500">{active + 1} / {featured.length}</span>
        <button className={arrow} onClick={() => go(active - 1)} aria-label="前へ">‹</button>
        <button className={arrow} onClick={() => go(active + 1)} aria-label="次へ">›</button>
      </div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {featured.map((f, i) => (
          <Slide
            key={f.path}
            f={f} index={i} count={featured.length}
            items={items} designations={designations} coastal={coastal}
            show={seen.has(i)}
          />
        ))}
      </div>
    </section>
  )
}

export default FeaturedCarousel
