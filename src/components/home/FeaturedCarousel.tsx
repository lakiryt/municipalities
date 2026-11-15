import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatValue } from '@/lib/format'
import { featuredRankings, type Featured } from '@/rankings/featured'
import type { FeaturedSnapshot } from '@/rankings/featuredSnapshot'
import RankingMap from './RankingMap'

const NAVY = '#13294b'
// Auto-advance: every so often, unless paused, hovered, focused inside, or
// the reader prefers reduced motion.
const INTERVAL_MS = 20_000

type SlideData = FeaturedSnapshot['slides'][string]

// The numbers and maps come prerendered (scripts/prerender-featured.mjs);
// the wording comes from featured.ts.
let snapshotPromise: Promise<FeaturedSnapshot | null> | null = null
const fetchSnapshot = () =>
  snapshotPromise ??= fetch('/featured/index.json').then(r => (r.ok ? r.json() : null)).catch(() => null)

function Slide({ f, index, count, data, aspect, eager }: { f: Featured; index: number; count: number; data: SlideData | undefined; aspect: number; eager: boolean }) {
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
        <RankingMap
          src={data && `/featured/${data.svg}`}
          legend={data?.legend}
          format={format}
          to={`${f.path}?map=@${f.mapColumn}`}
          label={f.question}
          aspect={aspect}
          eager={eager}
        />
        <div>
          <ol className="divide-y divide-gray-100">
            {data?.top.map((row, i) => (
              <li key={row.code} className="flex items-baseline gap-2 py-1.5 text-sm">
                <span className="w-4 text-right text-xs text-gray-400 tabular-nums">{i + 1}</span>
                <Link to={`/m/${row.code}`} className="font-medium text-[#13294b] hover:underline">{row.name}</Link>
                <span className="text-xs text-gray-500">{row.pref}</span>
                <span className="ml-auto tabular-nums font-semibold">{format(row.value)}</span>
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
// Maps past the first two load as they come near.
function FeaturedCarousel() {
  const featured = useMemo(() => featuredRankings(), [])
  const [snapshot, setSnapshot] = useState<FeaturedSnapshot | null>(null)
  useEffect(() => { fetchSnapshot().then(setSnapshot) }, [])
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
              data={snapshot?.slides[f.path]}
              aspect={snapshot?.aspect ?? 1.17}
              eager={seen.has(i)}
            />
          ))}
        </div>
        <button className={`${arrow} right-1 lg:-right-14`} onClick={() => go(active + 1)} aria-label="次へ">›</button>
      </div>
    </section>
  )
}

export default FeaturedCarousel
