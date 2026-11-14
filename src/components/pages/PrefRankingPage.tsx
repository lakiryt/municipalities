import { useParams, useSearchParams } from 'react-router-dom'
import { prefectures, selectionFromParams, type DataSelection } from '../../data/datasets'
import type { RankingConfig } from '../../types'
import RankingPage from './RankingPage'

type Pref = (typeof prefectures)[number]
// The config may depend on データの選択 (e.g. the period 人口増減 compares).
type Props = { configFor: (pref: Pref | null, selection: DataSelection) => RankingConfig }

// A ranking under /rankings/:pref/… — `all` for the whole country, otherwise
// a prefecture's URL slug.
function PrefRankingPage({ configFor }: Props) {
  const { pref } = useParams<{ pref: string }>()
  const [searchParams] = useSearchParams()
  const prefecture = pref === 'all' ? null : (prefectures.find(p => p.romanized === pref) ?? null)
  // key: remount when moving between prefectures, so the table starts fresh.
  return <RankingPage key={pref} config={configFor(prefecture, selectionFromParams(searchParams))} />
}

export default PrefRankingPage
