import { useState } from 'react'
import { Link } from 'react-router-dom'
import { prefectures } from '@/data/datasets'
import { changePeriod } from '@/rankings/populationChange'
import { REGIONS } from '@/data/prefTiles'
import { useCensusOverview, type CensusRow } from '@/data/useCensusOverview'
import { formatRate } from '@/lib/changeScale'
import { BRAND_NAME, BRAND_SERIES } from '@/lib/brand'
import { CATALOG, rankingPath } from '@/rankings/catalog'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import SiteFooter from '@/components/SiteFooter'
import ChangeMap from '@/components/home/ChangeMap'
import MuniSearch from '@/components/home/MuniSearch'

const NAVY = '#13294b'

function RateList({ title, rows, more }: { title: string; rows: CensusRow[]; more: { to: string; label: string } }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <ol className="divide-y divide-gray-100">
        {rows.map((r, i) => (
          <li key={r.code} className="flex items-baseline gap-2 py-1.5 text-sm">
            <span className="w-4 text-right text-xs text-gray-400 tabular-nums">{i + 1}</span>
            <Link to={`/m/${r.code}`} className="font-medium text-[#13294b] hover:underline">{r.name}</Link>
            <span className="text-xs text-gray-500">{r.prefName}</span>
            <span className="ml-auto tabular-nums font-semibold">{formatRate(r.rate)}</span>
          </li>
        ))}
      </ol>
      <Link to={more.to} className="mt-1 inline-block text-xs text-blue-700 hover:underline">{more.label} →</Link>
    </div>
  )
}

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { municipalities, places, prefs, loaded } = useCensusOverview()
  const period = changePeriod()

  const withRate = municipalities.filter(m => !Number.isNaN(m.rate)).sort((a, b) => b.rate - a.rate)
  const counted = municipalities.filter(m => !Number.isNaN(m.latest)).length
  const growingPrefs = prefs.filter(p => p.rate > 0).map(p => p.prefName)
  const growingMunis = withRate.filter(m => m.rate > 0).length
  const nameByCode = new Map(municipalities.map(m => [m.code, m.name]))
  // A ward's `parent` is its city's name; cities are unique by name within a prefecture.
  const cityCode = new Map(municipalities.map(m => [`${m.prefCode}${m.name}`, m.code]))
  const parentOf = new Map(places.flatMap(p => {
    const city = p.parent && cityCode.get(`${p.prefCode}${p.parent}`)
    return city ? [[p.code, city] as const] : []
  }))

  return (
    <>
      <title>まちくらべ — 市区町村の人口・人口増減・面積のランキングと地図｜霊智堂Atlas</title>
      <meta name="description" content={`全国の市区町村を、人口・人口増減率（国勢調査${period}）・面積・人口密度・家賃などでくらべるランキングと地図。都道府県別のランキングや、市区町村ごとの詳しいデータも見られます。`} />
      <Canonical />
      <AppHeader onMenuClick={() => setMenuOpen(true)} brandAfterScroll />
      {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}

      <main>
        {/* Hero: what this is, and the quickest way in — a municipality's name.
            It runs up under the bar, which stays see-through until scrolled. */}
        <section className="bg-[#f4f7fb] border-b border-[#e3eaf3]">
          <div className="max-w-5xl mx-auto px-4 pt-14 pb-8 md:pt-20 md:pb-12">
            <div className="flex items-center gap-3 md:gap-4">
              <img src="/logo.svg" alt="" className="h-12 w-12 md:h-16 md:w-16 shrink-0" />
              <div>
                <p className="text-xs tracking-widest text-gray-500">{BRAND_SERIES}</p>
                <h1 className="mt-0.5 text-4xl md:text-5xl font-black tracking-tight" style={{ color: NAVY }}>{BRAND_NAME}</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-gray-700 leading-relaxed">
              全国{counted > 0 ? counted.toLocaleString('ja-JP') : ''}市区町村のデータを、ランキングと地図で。
            </p>
            <div className="mt-5 max-w-xl">
              <MuniSearch entries={places.map(p => ({ code: p.code, name: p.name, kana: p.kana, prefName: p.prefName, population: p.latest }))} />
            </div>
          </div>
        </section>

        {/* Featured: the newest census, which is what people search for now. */}
        <section className="max-w-5xl mx-auto px-4 py-8" aria-labelledby="change">
          <h2 id="change" className="text-xl md:text-2xl font-bold" style={{ color: NAVY }}>人口が増えたまち・減ったまち</h2>
          <p className="mt-1 text-sm text-gray-600">
            国勢調査（{period}）。
            {loaded && <>人口が増えたのは{growingPrefs.length ? growingPrefs.join('・') : 'なし'}だけ、市区町村では{withRate.length.toLocaleString('ja-JP')}のうち{growingMunis}でした。</>}
          </p>
          <div className="mt-5 grid gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start">
            <ChangeMap
              rates={new Map(municipalities.map(m => [m.code, m.rate]))}
              parentOf={parentOf}
              nameOf={c => nameByCode.get(c) ?? c}
              to="/rankings/all/population-change?map=@1"
              caption="市区町村の人口増減率"
            />
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
              {loaded ? (
                <>
                  <RateList title="増加率が高い市区町村" rows={withRate.slice(0, 5)} more={{ to: '/rankings/all/population-change', label: '人口増加率ランキング' }} />
                  <RateList title="減少率が高い市区町村" rows={withRate.slice(-5).reverse()} more={{ to: '/rankings/all/population-decline', label: '人口減少率ランキング' }} />
                </>
              ) : <p className="text-sm text-gray-400">読み込み中…</p>}
            </div>
          </div>
        </section>

        <section className="bg-[#fafaf9] border-y border-gray-100" aria-labelledby="prefs">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <h2 id="prefs" className="text-xl font-bold" style={{ color: NAVY }}>都道府県からさがす</h2>
            <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {REGIONS.map(r => (
                <div key={r.name} className="flex gap-3">
                  <span className="w-20 shrink-0 text-xs text-gray-500 pt-1">{r.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {prefectures.filter(p => { const n = Number(p.code.slice(0, 2)); return n >= r.from && n <= r.to }).map(p => (
                      <Link
                        key={p.code}
                        to={`/rankings/${p.romanized}`}
                        className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-sm text-[#13294b] hover:border-[#4a6fa5] hover:bg-[#eef3fa]"
                      >
                        {p.kanji}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 py-8" aria-labelledby="rankings">
          <h2 id="rankings" className="text-xl font-bold" style={{ color: NAVY }}>全国のランキング</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATALOG.map(g => (
              <div key={g.title} className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">{g.title}</h3>
                <ul className="space-y-1.5">
                  {g.entries.map(e => (
                    <li key={e.slug}>
                      <Link to={rankingPath(e)} className="text-[#13294b] hover:underline">{e.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-bold" style={{ color: NAVY }}>自分で表をつくる</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link to="/explore" className="rounded-xl border border-gray-200 p-4 hover:border-[#4a6fa5] hover:bg-[#f4f7fb]">
              <div className="font-semibold text-[#13294b]">自由探索</div>
              <div className="text-sm text-gray-600">列・並べ替え・絞り込みを自由に</div>
            </Link>
            <Link to="/search" className="rounded-xl border border-gray-200 p-4 hover:border-[#4a6fa5] hover:bg-[#f4f7fb]">
              <div className="font-semibold text-[#13294b]">詳細検索</div>
              <div className="text-sm text-gray-600">都道府県・種別・区分・よみかたで</div>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

export default HomePage
