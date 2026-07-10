import { useParams } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import { areaConfig } from '../../rankings/area'
import RankingPage from './RankingPage'

function AreaPage() {
  const { pref } = useParams<{ pref: string }>()
  const prefecture = pref === 'all'
    ? null
    : (prefectures.find(p => p.romanized === pref) ?? null)
  return <RankingPage config={areaConfig(prefecture)} />
}

export default AreaPage
