import { useParams, useSearchParams } from 'react-router-dom'
import { prefectures, selectionFromParams } from '../../data/datasets'
import type { CatalogEntry } from '../../rankings/catalog'
import RankingPage from './RankingPage'

type Props = { configFor: CatalogEntry['configFor'] }

// A ranking under /rankings/:pref/… — `all` (or a national-only route, which
// has no :pref) for the whole country, otherwise a prefecture's URL slug.
function PrefRankingPage({ configFor }: Props) {
  const { pref } = useParams<{ pref: string }>()
  const [searchParams] = useSearchParams()
  const prefecture = pref === 'all' ? null : (prefectures.find(p => p.romanized === pref) ?? null)
  // key: remount when moving between prefectures, so the table starts fresh.
  return <RankingPage key={pref} config={configFor(prefecture, selectionFromParams(searchParams))} />
}

export default PrefRankingPage
