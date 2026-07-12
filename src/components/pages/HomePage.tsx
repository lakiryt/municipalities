import { Link } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import populationOver500k from '../../rankings/populationOver500k'
import { populationConfig } from '../../rankings/population'
import { cityPopulationConfig } from '../../rankings/cityPopulation'
import { densityConfig } from '../../rankings/density'
import { areaConfig, cityAreaConfig } from '../../rankings/area'
import elderlyRatioConfig from '../../rankings/elderlyRatio'
import rentConfig from '../../rankings/rent'
import { encodeExploreState } from '../../lib/exploreState'
import Canonical from '../Canonical'

const rentVsMinWageUrl = `/explore?s=${encodeURIComponent(encodeExploreState({
  columns: [
    { id: 0, label: '都道府県', expression: '$prefkanji' },
    { id: 1, label: '自治体名', expression: '$kanji' },
    { id: 2, label: '平均家賃（30㎡）', expression: 'MULT(30, #rent_exc0)' },
    { id: 3, label: '最低賃金', expression: '#minwage' },
    { id: 4, label: '平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数', expression: 'ROUND(MULT(30,#rent_exc0,INV(MULT(#minwage,8))),2)' },
  ],
  filterExpression: '',
  sortExpression: 'MULT(20, #rent_exc0)',
  sortDirection: 'desc',
}))}&map=@4`

function HomePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <title>日本の自治体データ 人口・面積ランキング</title>
      <meta name="description" content="全国の市区町村（都道府県・市区町村）の人口・面積・人口密度・老年人口比率ランキングを掲載。都道府県別の絞り込みや、条件を自由に組み合わせた検索・比較もできます。" />
      <Canonical />
      <h1 className="text-3xl font-bold mb-2">日本の自治体データ</h1>
      <p className="text-gray-500 mb-8">
        全国の市区町村を対象に、人口・面積・人口密度・老年人口比率などのランキングと統計データを掲載しています。都道府県ごとの絞り込みや、条件を自由に組み合わせた検索・比較も可能です。
      </p>

      <Link
        to="/search"
        className="flex items-center gap-3 w-full mb-10 px-5 py-4 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <div>
          <div className="text-base font-semibold text-blue-700">詳細検索</div>
          <div className="text-sm text-blue-500">都道府県・種別・区分・よみかたで絞り込む</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 ml-auto group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ランキング</h2>
        <ul className="space-y-1">
          <li><Link to="/rankings/all/density" className="text-blue-600 hover:underline">{densityConfig(null).title}</Link></li>
          <li><Link to="/rankings/all/cities" className="text-blue-600 hover:underline">{cityPopulationConfig(null).title}</Link></li>
          <li><Link to="/rankings/all/area" className="text-blue-600 hover:underline">{areaConfig(null).title}</Link></li>
          <li><Link to="/rankings/all/city-area" className="text-blue-600 hover:underline">{cityAreaConfig(null).title}</Link></li>
          <li><Link to="/rankings/all/elderly-ratio" className="text-blue-600 hover:underline">{elderlyRatioConfig.title}</Link></li>
          <li><Link to="/rankings/all/rent" className="text-blue-600 hover:underline">{rentConfig.title}</Link></li>
          <li><Link to={rentVsMinWageUrl} className="text-blue-600 hover:underline">全国の自治体の平均家賃（30㎡）を稼ぐのに必要な最低賃金労働日数ランキング</Link></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">一覧・統計</h2>
        <ul className="space-y-1">
          <li><Link to={`/rankings/all/population-over-500k`} className="text-blue-600 hover:underline">{populationOver500k.title}</Link></li>
          <li><Link to="/list/all/population" className="text-blue-600 hover:underline">{populationConfig.title}</Link></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">都道府県別人口密度</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {prefectures.map(pref => (
            <Link
              key={pref.code}
              to={`/rankings/${pref.romanized}/density`}
              className="text-blue-600 hover:underline text-sm"
            >
              {pref.kanji}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">都道府県別市の人口ランキング</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {prefectures.map(pref => (
            <Link
              key={pref.code}
              to={`/rankings/${pref.romanized}/cities`}
              className="text-blue-600 hover:underline text-sm"
            >
              {pref.kanji}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">都道府県別面積ランキング（市区町村）</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {prefectures.map(pref => (
            <Link
              key={pref.code}
              to={`/rankings/${pref.romanized}/area`}
              className="text-blue-600 hover:underline text-sm"
            >
              {pref.kanji}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">都道府県別面積ランキング（市のみ）</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {prefectures.map(pref => (
            <Link
              key={pref.code}
              to={`/rankings/${pref.romanized}/city-area`}
              className="text-blue-600 hover:underline text-sm"
            >
              {pref.kanji}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ツール</h2>
        <ul className="space-y-1">
          <li><Link to="/explore" className="text-blue-600 hover:underline">自由探索</Link></li>
        </ul>
      </section>
    </div>
  )
}

export default HomePage
