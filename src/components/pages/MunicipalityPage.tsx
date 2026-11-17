import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  officialCodes, prefectures, selectionFromParams, writeSelectionParams, fetchAdjacency, fetchPopulationSeries,
  type DataSelection, type DataKey, type SeriesPoint,
} from '@/data/datasets'
import { useMunicipalityData } from '@/data/useMunicipalityData'
import { metricValues } from '@/data/metrics'
import { formatValue, explainMissing } from '@/lib/format'
import { isMissing } from '@/lang/value'
import AppHeader from '@/components/AppHeader'
import { pageTitle } from '@/lib/brand'
import PageHeader from '@/components/PageHeader'
import Sidebar from '@/components/Sidebar'
import Canonical from '@/components/Canonical'
import DataModal from '@/components/modals/DataModal'
import TrendChart from '@/components/detail/TrendChart'
import AgePyramid from '@/components/detail/AgePyramid'
import LocatorMap from '@/components/detail/LocatorMap'

// 「全国 135位 / 1,747」: a button into the ranking it refers to.
function RankButton({ to, scope, rank }: { to?: string; scope: string; rank: { rank: number; of: number } }) {
  const body = (
    <>
      <span className="text-gray-500">{scope}</span>
      <span className="ml-auto"><b className="text-sm text-gray-900">{rank.rank.toLocaleString('ja-JP')}</b>位<span className="text-gray-400"> / {rank.of.toLocaleString('ja-JP')}</span></span>
    </>
  )
  if (!to) return <div className="flex items-baseline gap-2 px-2 py-1">{body}</div>
  return (
    <Link
      to={to}
      className="flex items-baseline gap-2 rounded-md bg-navy-50 px-2 py-1 text-gray-700 hover:bg-navy-100 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-navy-500"
      aria-label={`${scope}のランキングで${rank.rank}位（${rank.of}中）`}
    >
      {body}
      <span className="text-gray-400" aria-hidden="true">›</span>
    </Link>
  )
}

// /m/:code — one municipality: its figures with national and in-prefecture
// ranks, its population over the years, its age structure, and where it is
// (with links to its neighbors). Uses the same データの選択 as the tables.
function MunicipalityPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = useMemo(() => selectionFromParams(searchParams), [searchParams])
  const { items, designations, coastal, loaded } = useMunicipalityData(selection, true)
  const [adjacency, setAdjacency] = useState<Record<string, string[]>>({})
  const [series, setSeries] = useState<SeriesPoint[]>([])
  // データの選択: open (optionally focused on one dataset, from its chip) or closed.
  const [dataModal, setDataModal] = useState<{ focus?: DataKey } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { fetchAdjacency().then(setAdjacency) }, [])
  useEffect(() => { fetchPopulationSeries(code).then(setSeries) }, [code])

  const byCode = useMemo(() => new Map(items.map(i => [i.code, i])), [items])
  const item = byCode.get(code)
  const official = officialCodes.has(code)
  const parentCity = item?.parent || undefined
  const pref = prefectures.find(p => p.code.slice(0, 2) === code.slice(0, 2))
  const name = item?.kanji || ''
  const nameOf = (c: string) => byCode.get(c)?.kanji || c

  const kind = designations?.seirei.has(code) ? '政令指定都市'
    : designations?.chukaku.has(code) ? '中核市'
    : designations?.tokurei.has(code) ? '施行時特例市'
    : item?.kind === '特別区' ? '特別区'
    : parentCity ? `${nameOf(parentCity)}の区` : ''

  // Shapes: the code itself, or (for a designated city) all of its wards.
  const wards = useMemo(() => items.filter(i => i.parent === code).map(i => i.code), [items, code])
  const targets = useMemo(() => (adjacency[code] ? [code] : wards), [adjacency, code, wards])
  const neighbors = useMemo(() => {
    const own = new Set(targets)
    const out = new Set<string>()
    for (const t of targets) for (const n of adjacency[t] ?? []) if (n !== 'coast' && !own.has(n) && !n.endsWith('000')) out.add(n)
    return [...out].sort()
  }, [adjacency, targets])

  const metrics = useMemo(
    () => (loaded ? metricValues(code, items, officialCodes, designations, coastal) : []),
    [loaded, code, items, designations, coastal]
  )

  const query = writeSelectionParams(new URLSearchParams(), selection).toString()
  const linkTo = (c: string) => `/m/${c}${query ? `?${query}` : ''}`
  // The ranking a figure's rank refers to, with this municipality's row marked.
  const rankingLink = (slug: string, scope: string) => {
    const q = writeSelectionParams(new URLSearchParams(), selection)
    q.set('at', code)
    return `/rankings/${scope}/${slug}?${q}`
  }
  const title = name ? `${name}（${pref?.kanji ?? ''}）` : ''

  useEffect(() => {
    if (title) document.title = pageTitle(`${title}の人口・面積・人口密度`)
  }, [title])

  if (loaded && (!item || !name || (!official && !parentCity))) {
    return (
      <>
        <AppHeader onMenuClick={() => setMenuOpen(true)} />
        {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}
        <main className="pt-16 max-w-3xl mx-auto px-4">
          <h1 className="text-xl font-bold">自治体が見つかりません</h1>
          <p className="mt-2 text-sm text-gray-600">コード「{code}」の市区町村ページはありません。</p>
          <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">トップへ</Link>
        </main>
      </>
    )
  }

  return (
    <>
      <Canonical />
      {title && <meta name="description" content={`${title}の人口・世帯数・面積・人口密度・老年人口比率などを、全国と${pref?.kanji ?? '都道府県'}内の順位、人口の推移、年齢構成、隣接自治体とあわせて掲載しています。`} />}
      <AppHeader onMenuClick={() => setMenuOpen(true)} />
      {menuOpen && <Sidebar onClose={() => setMenuOpen(false)} />}
      {dataModal && (
        <DataModal
          focus={dataModal.focus}
          selection={selection}
          onApply={(next: DataSelection) => { setSearchParams(prev => writeSelectionParams(new URLSearchParams(prev), next)); setDataModal(null) }}
          onClose={() => setDataModal(null)}
        />
      )}
      <main className="pt-11 pb-8">
        <nav className="max-w-5xl mx-auto px-4 pt-3 text-xs text-gray-500" aria-label="パンくず">
          <Link to="/" className="hover:underline">トップ</Link>
          {pref && <> › <Link to={`/rankings/${pref.romanized}`} className="hover:underline">{pref.kanji}</Link></>}
          {parentCity && <> › <Link to={linkTo(parentCity)} className="hover:underline">{nameOf(parentCity)}</Link></>}
        </nav>
        <PageHeader
          title={name}
          description={[item?.kana, pref?.kanji, kind, `自治体コード ${code}`].filter(Boolean).join('・')}
          used={['pop', 'change', 'area', 'rent', 'minwage']}
          selection={selection}
          onDataClick={k => setDataModal({ focus: k })}
        />

        <div className="max-w-5xl mx-auto px-4 space-y-8">
          <section aria-labelledby="figures">
            <h2 id="figures" className="sr-only">主な数値</h2>
            {!loaded ? <p className="text-sm text-gray-400">読み込み中…</p> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {metrics.map(({ metric, value, national, prefecture }) => (
                  <div key={metric.key} className="rounded-lg border border-gray-200 p-3 flex flex-col" data-testid={`metric-${metric.key}`}>
                    <div className="text-xs text-gray-500">{metric.label}</div>
                    <div className="mt-0.5 text-lg font-semibold tabular-nums">
                      {isMissing(value)
                        ? <span title={explainMissing(value)}>{formatValue(value)}</span>
                        : <>{formatValue(value)}<span className="ml-1 text-xs font-normal text-gray-500">{metric.unit}</span></>}
                    </div>
                    {national && (
                      <div className="mt-auto pt-1.5 flex flex-col gap-1 text-xs tabular-nums">
                        <RankButton to={metric.ranking && rankingLink(metric.ranking, 'all')} scope="全国" rank={national} />
                        {prefecture && pref && <RankButton to={metric.ranking && rankingLink(metric.ranking, pref.romanized)} scope={pref.kanji} rank={prefecture} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <section aria-labelledby="trend">
              <h2 id="trend" className="font-semibold mb-1">人口の推移</h2>
              <p className="text-xs text-gray-500 mb-2">住民基本台帳</p>
              <TrendChart points={series} />
            </section>
            <section aria-labelledby="ages">
              <h2 id="ages" className="font-semibold mb-1">年齢構成</h2>
              {item && <AgePyramid population={item.population} />}
            </section>
          </div>

          <section aria-labelledby="where">
            <h2 id="where" className="font-semibold mb-2">位置と隣接自治体</h2>
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <LocatorMap targets={targets} label={name} neighbors={neighbors} nameOf={nameOf} onSelect={c => navigate(linkTo(c))} />
              <ul className="divide-y divide-gray-100 text-sm" data-testid="neighbors">
                {neighbors.map(n => {
                  const ni = byCode.get(n)
                  const pop = ni?.population.totalpop
                  return (
                    <li key={n} className="flex items-baseline gap-2 py-1.5">
                      <Link to={linkTo(n)} className="text-blue-600 hover:underline">{nameOf(n)}</Link>
                      {n.slice(0, 2) !== code.slice(0, 2) && <span className="text-xs text-gray-400">{ni?.prefecture.kanji}</span>}
                      <span className="ml-auto text-xs text-gray-500 tabular-nums">{pop !== undefined && !Number.isNaN(pop) ? `${formatValue(pop)}人` : ''}</span>
                    </li>
                  )
                })}
                {neighbors.length === 0 && <li className="py-1.5 text-gray-500">陸続きで隣接する自治体はありません。</li>}
              </ul>
            </div>
          </section>
        </div>

      </main>
    </>
  )
}

export default MunicipalityPage
