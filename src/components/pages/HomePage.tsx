import { useState } from 'react'
import { Link } from 'react-router-dom'
import { prefectures } from '@/data/datasets'
import { changePeriod } from '@/rankings/populationChange'
import { REGIONS } from '@/data/prefTiles'
import { useCensusOverview } from '@/data/useCensusOverview'
import { BRAND_NAME, BRAND_SERIES } from '@/lib/brand'
import { CATALOG, rankingPath } from '@/rankings/catalog'
import AppHeader from '@/components/AppHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import SiteFooter from '@/components/SiteFooter'
import FeaturedCarousel from '@/components/home/FeaturedCarousel'
import MuniSearch from '@/components/home/MuniSearch'

const NAVY = '#13294b'

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { municipalities, places } = useCensusOverview()
  const period = changePeriod()

  const counted = municipalities.filter(m => !Number.isNaN(m.latest)).length

  return (
    <>
      <title>霊智堂Atlas 自治体データ — 市区町村のランキングと地図</title>
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

        {/* Featured: rankings picked for the question behind them. */}
        <FeaturedCarousel />

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
