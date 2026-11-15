import { useEffect, useMemo, useRef, useState } from 'react'
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
// Auto-advance: every so often, unless paused, hovered, focused inside, or
// the reader prefers reduced motion.
const INTERVAL_MS = 20_000

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

const scrollToSlide = (track: HTMLElement | null, i: number) =>
  track?.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' })

// The home page's picks, one ranking per slide: ‹ ›, the dots or a swipe
// move between them, and they move on by themselves every INTERVAL_MS.
// A slide's map is drawn once it's been near the screen.
function FeaturedCarousel() {
  const featured = useMemo(() => featuredRankings(), [])
  const { items, designations, coastal } = useMunicipalityData(defaultDataSelection(), true)
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState(() => new Set([0, 1]))
  const [stopped, setStopped] = useState(false)   // the pause button
  const [holding, setHolding] = useState(false)   // pointer over / focus inside
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const playing = !stopped && !reduced

  const count = featured.length
  const go = (i: number) => scrollToSlide(trackRef.current, (i + count) % count)
  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const i = Math.round(track.scrollLeft / track.clientWidth)
    if (i === active) return
    setActive(i)
    if (!seen.has(i + 1) || !seen.has(i)) setSeen(s => new Set([...s, i, i + 1]))
  }

  // Restarts whenever the slide changes (by hand or by itself), so a slide
  // the reader just moved to always gets the full interval.
  useEffect(() => {
    if (!playing || holding) return
    const t = setTimeout(() => { if (!document.hidden) scrollToSlide(trackRef.current, (active + 1) % count) }, INTERVAL_MS)
    return () => clearTimeout(t)
  }, [active, playing, holding, count])

  const arrow = 'absolute top-56 md:top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full border border-gray-200 bg-white/90 text-xl leading-none text-[#13294b] shadow-sm hover:border-[#4a6fa5] hover:bg-white'
  return (
    <section
      className="max-w-5xl mx-auto px-4 py-8"
      aria-roledescription="カルーセル"
      aria-label="ピックアップ"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false) }}
    >
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
        {!reduced && (
          <button
            onClick={() => setStopped(s => !s)}
            aria-label={stopped ? '自動で進める' : '自動で進めるのを止める'}
            className="h-7 w-7 rounded-full text-xs text-gray-500 hover:bg-gray-100"
          >
            {stopped ? '▶' : '❚❚'}
          </button>
        )}
      </div>
      <div className="relative">
        <button className={`${arrow} left-1 lg:-left-14`} onClick={() => go(active - 1)} aria-label="前へ">‹</button>
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        <button className={`${arrow} right-1 lg:-right-14`} onClick={() => go(active + 1)} aria-label="次へ">›</button>
      </div>
    </section>
  )
}

export default FeaturedCarousel
