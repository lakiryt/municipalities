import { Link } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import populationOver500k from '../../rankings/populationOver500k'
import { populationConfig } from '../../rankings/population'
import { cityPopulationConfig } from '../../rankings/cityPopulation'

function HomePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <title>日本の自治体データ</title>
      <h1 className="text-3xl font-bold mb-2">日本の自治体データ</h1>
      <p className="text-gray-500 mb-10">人口・面積・その他の統計</p>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ランキング</h2>
        <ul className="space-y-1">
          <li><Link to="/rankings/all/density" className="text-blue-600 hover:underline">全国の自治体 — 人口密度ランキング</Link></li>
          <li><Link to={`/rankings/all/population-over-500k`} className="text-blue-600 hover:underline">{populationOver500k.title}</Link></li>
          <li><Link to="/list/all/population" className="text-blue-600 hover:underline">{populationConfig.title}</Link></li>
          <li><Link to="/rankings/all/cities" className="text-blue-600 hover:underline">{cityPopulationConfig(null).title}</Link></li>
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

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ツール</h2>
        <ul>
          <li><Link to="/explore" className="text-blue-600 hover:underline">自由探索</Link></li>
        </ul>
      </section>
    </div>
  )
}

export default HomePage
