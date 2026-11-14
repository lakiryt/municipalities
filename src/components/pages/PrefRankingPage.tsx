import { useParams } from 'react-router-dom'
import { prefectures } from '../../data/datasets'
import type { RankingConfig } from '../../types'
import RankingPage from './RankingPage'

type Pref = (typeof prefectures)[number]
type Props = { configFor: (pref: Pref | null) => RankingConfig }

// A ranking under /rankings/:pref/… — `all` for the whole country, otherwise
// a prefecture's URL slug.
function PrefRankingPage({ configFor }: Props) {
  const { pref } = useParams<{ pref: string }>()
  const prefecture = pref === 'all' ? null : (prefectures.find(p => p.romanized === pref) ?? null)
  // key: remount when moving between prefectures, so the table starts fresh.
  return <RankingPage key={pref} config={configFor(prefecture)} />
}

export default PrefRankingPage
