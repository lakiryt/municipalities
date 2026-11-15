import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { prefectures, selectedSource, defaultDataSelection } from '@/data/datasets'
import { changePeriod } from '@/rankings/populationChange'
import { useCensusOverview, type CensusRow } from '@/data/useCensusOverview'
import { changeClass, formatRate } from '@/lib/changeScale'
import { CATALOG, rankingPath } from '@/rankings/catalog'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import { pageTitle } from '@/lib/brand'
import SiteFooter from '@/components/SiteFooter'

const NAVY = '#13294b'
const KINDS: { kind: CensusRow['kind']; label: string }[] = [
  { kind: '市', label: '市' }, { kind: '特別区', label: '特別区' }, { kind: '町', label: '町' }, { kind: '村', label: '村' },
]

function RateBadge({ rate }: { rate: number }) {
  const cls = changeClass(rate)
  if (!cls) return <span className="text-gray-400">—</span>
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: cls.fill }} aria-hidden="true" />
      {formatRate(rate)}
    </span>
  )
}

// A headline figure; the whole card leads to the ranking behind it.
function FigureCard({ to, label, note, children }: { to: string; label: string; note?: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="group flex flex-col rounded-lg border border-gray-200 p-3 hover:border-[#4a6fa5] hover:bg-[#f4f7fb]">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="mt-0.5 flex items-baseline text-lg font-semibold text-gray-900">
        {children}
        <span className="ml-auto text-sm font-normal text-gray-300 group-hover:text-[#4a6fa5]" aria-hidden="true">›</span>
      </span>
      {note && <span className="text-xs text-gray-500">{note}</span>}
    </Link>
  )
}

// /rankings/:pref — one prefecture's landing page: its figures, every
// ranking that exists for it, and all its municipalities (each linking to
// its own page). Most searches arrive as "〇〇県 + 指標", so this is the hub
// they land next to.
function PrefHubPage() {
  const { pref: slug } = useParams<{ pref: string }>()
  const [menuOpen, setMenuOpen] = useState(false)
  const pref = prefectures.find(p => p.romanized === slug)
  const { municipalities, prefs, loaded } = useCensusOverview()
  const period = changePeriod()
  const year = selectedSource('change', defaultDataSelection())?.as_of.slice(0, 4) ?? ''

  if (!pref) {
    return (
      <>
        <AppHeader onMenuClick={() => setMenuOpen(true)} />
        {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}
        <main className="pt-11 max-w-5xl mx-auto px-4 py-10">
          <h1 className="text-xl font-bold">ページが見つかりません</h1>
          <p className="mt-2 text-sm"><Link to="/" className="text-blue-700 hover:underline">トップへ</Link></p>
        </main>
      </>
    )
  }

  const code2 = pref.code.slice(0, 2)
  const self = prefs.find(p => p.prefCode === code2)
  const mine = municipalities.filter(m => m.prefCode === code2 && !Number.isNaN(m.latest))
  const counts = KINDS.map(k => ({ ...k, n: mine.filter(m => m.kind === k.kind).length })).filter(k => k.n > 0)
  const growing = mine.filter(m => m.rate > 0).length
  const title = `${pref.kanji}の市区町村 人口・面積ランキングと一覧`
  const hasVillages = counts.some(k => k.kind === '村')
  const rank = (slug: string) => `/rankings/${pref.romanized}/${slug}`

  return (
    <>
      <title>{pageTitle(title)}</title>
      <meta name="description" content={`${pref.kanji}の市区町村の一覧と、人口・人口増減率（国勢調査${period}）・人口密度・面積のランキング。`} />
      <Canonical />
      <AppHeader onMenuClick={() => setMenuOpen(true)} />
      {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}

      <main className="pt-11 pb-10">
        <nav className="max-w-5xl mx-auto px-4 pt-3 text-xs text-gray-500" aria-label="パンくず">
          <Link to="/" className="hover:underline">トップ</Link> › {pref.kanji}
        </nav>
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: NAVY }}>{pref.kanji}</h1>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="pref-figures">
            <FigureCard to={rank('population')} label={`人口（${year}年 国勢調査）`}>
              <span className="tabular-nums">{self && !Number.isNaN(self.latest) ? `${self.latest.toLocaleString('ja-JP')}人` : '—'}</span>
            </FigureCard>
            <FigureCard to={rank('population-change')} label={`人口増減率（${period}）`}>
              {self ? <RateBadge rate={self.rate} /> : '—'}
            </FigureCard>
            <FigureCard to={rank('population')} label="市区町村の数" note={counts.map(k => `${k.label}${k.n}`).join('・')}>
              <span className="tabular-nums">{loaded ? mine.length : '—'}</span>
            </FigureCard>
            <FigureCard to={rank('population-change')} label="人口が増えた市区町村">
              <span className="tabular-nums">{loaded ? `${growing} / ${mine.length}` : '—'}</span>
            </FigureCard>
          </div>
        </div>

        <section className="max-w-5xl mx-auto px-4 mt-8" aria-labelledby="pref-rankings">
          <h2 id="pref-rankings" className="text-lg font-bold" style={{ color: NAVY }}>{pref.kanji}のランキング</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOG.map(g => ({ ...g, entries: g.entries.filter(e => e.perPref && (e.slug !== 'villages' || hasVillages)) }))
              .filter(g => g.entries.length > 0)
              .map(g => (
                <div key={g.title}>
                  <h3 className="text-xs font-semibold text-gray-500 mb-1.5">{g.title}</h3>
                  <ul className="grid gap-1.5">
                    {g.entries.map(e => (
                      <li key={e.slug}>
                        <Link to={rankingPath(e, pref.romanized)} className="flex items-center rounded-lg border border-[#c9d6ea] bg-[#f4f7fb] px-3 py-2 hover:border-[#4a6fa5] hover:bg-[#e3ecf8]">
                          <span className="text-[#13294b] font-medium">{e.label}</span>
                          <span className="ml-auto text-gray-400" aria-hidden="true">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 mt-10" aria-labelledby="pref-list">
          <details className="group rounded-lg border border-gray-200">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
              <span className="text-gray-400 transition-transform group-open:rotate-90" aria-hidden="true">›</span>
              <h2 id="pref-list" className="font-medium">{pref.kanji}の市区町村一覧{loaded && <span className="ml-1 text-gray-400">（{mine.length}）</span>}</h2>
            </summary>
            {!loaded ? <p className="px-3 pb-3 text-sm text-gray-400">読み込み中…</p> : (
              <div className="grid gap-6 px-3 pb-3 pt-1 md:grid-cols-2" data-testid="pref-municipalities">
                {counts.map(k => (
                  <div key={k.kind}>
                    <h3 className="text-xs font-semibold text-gray-500">{k.label}（{k.n}）</h3>
                    <table className="mt-1 w-full text-sm">
                      <thead className="text-[11px] text-gray-400"><tr><th className="sr-only">名前</th><th className="text-right font-normal">人口（{year}年）</th><th className="text-right font-normal">{period}</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {mine.filter(m => m.kind === k.kind).sort((a, b) => b.latest - a.latest).map(m => (
                          <tr key={m.code}>
                            <td className="py-1"><Link to={`/m/${m.code}`} className="text-gray-700 hover:text-[#13294b] hover:underline">{m.name}</Link></td>
                            <td className="py-1 text-right tabular-nums text-gray-500">{m.latest.toLocaleString('ja-JP')}人</td>
                            <td className="py-1 pl-3 w-24 text-right text-xs text-gray-500"><RateBadge rate={m.rate} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </details>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

export default PrefHubPage
