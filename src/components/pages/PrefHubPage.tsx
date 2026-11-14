import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { censusPair, censusPeriod, prefectures } from '@/data/datasets'
import { useCensusOverview, type CensusRow } from '@/data/useCensusOverview'
import { changeClass, formatRate } from '@/lib/changeScale'
import { CATALOG, rankingPath } from '@/rankings/catalog'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import SiteFooter from '@/components/SiteFooter'

const NAVY = '#13294b'
const KINDS: { kind: CensusRow['kind']; label: string }[] = [
  { kind: '市', label: '市' }, { kind: '区', label: '特別区' }, { kind: '町', label: '町' }, { kind: '村', label: '村' },
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

// /rankings/:pref — one prefecture's landing page: its figures, every
// ranking that exists for it, and all its municipalities (each linking to
// its own page). Most searches arrive as "〇〇県 + 指標", so this is the hub
// they land next to.
function PrefHubPage() {
  const { pref: slug } = useParams<{ pref: string }>()
  const [menuOpen, setMenuOpen] = useState(false)
  const pref = prefectures.find(p => p.romanized === slug)
  const { municipalities, prefs, loaded } = useCensusOverview()
  const period = censusPeriod()
  const year = censusPair()?.latest.as_of.slice(0, 4) ?? ''

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

  return (
    <>
      <title>{`${title} — まちくらべ`}</title>
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
          <p className="mt-1 text-sm text-gray-600">{title}</p>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="pref-figures">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">人口（{year}年 国勢調査）</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{self && !Number.isNaN(self.latest) ? `${self.latest.toLocaleString('ja-JP')}人` : '—'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">人口増減率（{period}）</div>
              <div className="mt-0.5 text-lg font-semibold">{self ? <RateBadge rate={self.rate} /> : '—'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">市区町村の数</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{loaded ? mine.length : '—'}</div>
              <div className="text-xs text-gray-500">{counts.map(k => `${k.label}${k.n}`).join('・')}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">人口が増えた市区町村</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{loaded ? `${growing} / ${mine.length}` : '—'}</div>
            </div>
          </div>
        </div>

        <section className="max-w-5xl mx-auto px-4 mt-8" aria-labelledby="pref-rankings">
          <h2 id="pref-rankings" className="text-lg font-bold" style={{ color: NAVY }}>{pref.kanji}のランキング</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {CATALOG.flatMap(g => g.entries)
              .filter(e => e.perPref && (e.slug !== 'villages' || hasVillages))
              .map(e => (
                <li key={e.slug}>
                  <Link to={rankingPath(e, pref.romanized)} className="block rounded-lg border border-gray-200 px-3 py-2 hover:border-[#4a6fa5] hover:bg-[#f4f7fb]">
                    <span className="text-[#13294b] font-medium">{e.label}</span>
                    {e.note && <span className="ml-1.5 text-xs text-gray-400">{e.note}</span>}
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section className="max-w-5xl mx-auto px-4 mt-8" aria-labelledby="pref-list">
          <h2 id="pref-list" className="text-lg font-bold" style={{ color: NAVY }}>{pref.kanji}の市区町村一覧</h2>
          <p className="mt-1 text-xs text-gray-500">人口は国勢調査（{year}年）、増減率は{period}。名前から各市区町村のページへ。</p>
          {!loaded ? <p className="mt-3 text-sm text-gray-400">読み込み中…</p> : (
            <div className="mt-3 grid gap-6 md:grid-cols-2" data-testid="pref-municipalities">
              {counts.map(k => (
                <div key={k.kind}>
                  <h3 className="text-sm font-semibold text-gray-700">{k.label}（{k.n}）</h3>
                  <table className="mt-1 w-full text-sm">
                    <thead className="sr-only"><tr><th>名前</th><th>人口</th><th>増減率</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {mine.filter(m => m.kind === k.kind).sort((a, b) => b.latest - a.latest).map(m => (
                        <tr key={m.code}>
                          <td className="py-1"><Link to={`/m/${m.code}`} className="text-[#13294b] hover:underline">{m.name}</Link></td>
                          <td className="py-1 text-right tabular-nums text-gray-700">{m.latest.toLocaleString('ja-JP')}人</td>
                          <td className="py-1 pl-3 w-24 text-right text-xs"><RateBadge rate={m.rate} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

export default PrefHubPage
