import { useParams } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import { densityConfig } from '../../rankings/density'
import RankingPage from './RankingPage'

function DensityPage() {
  const { pref } = useParams<{ pref: string }>()
  const prefecture = pref === 'all'
    ? null
    : (prefectures.find(p => p.romanized === pref) ?? null)
  return <RankingPage config={densityConfig(prefecture)} />
}

export default DensityPage
