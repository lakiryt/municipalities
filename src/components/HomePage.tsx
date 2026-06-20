import { Link } from 'react-router-dom'
import hokkaidoDensity from '../rankings/hokkaidoDensity'
import populationOver500k from '../rankings/populationOver500k'

const rankings: { path: string; config: { title: string } }[] = [
  { path: '/rankings/hokkaido/density',          config: hokkaidoDensity },
  { path: '/rankings/all/population-over-500k', config: populationOver500k },
]

function HomePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <title>日本の自治体データ</title>
      <h1 className="text-3xl font-bold mb-2">日本の自治体データ</h1>
      <p className="text-gray-500 mb-10">人口・面積・その他の統計</p>

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ランキング</h2>
        <ul className="space-y-1">
          {rankings.map(({ path, config }) => (
            <li key={path}>
              <Link to={path} className="text-blue-600 hover:underline">{config.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">ツール</h2>
        <ul>
          <li>
            <Link to="/explore" className="text-blue-600 hover:underline">自由探索</Link>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default HomePage
