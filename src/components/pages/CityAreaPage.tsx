import { useParams } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import { cityAreaConfig } from '../../rankings/area'
import RankingPage from './RankingPage'

function CityAreaPage() {
  const { pref } = useParams<{ pref: string }>()
  const prefecture = pref === 'all'
    ? null
    : (prefectures.find(p => p.romanized === pref) ?? null)
  return <RankingPage config={cityAreaConfig(prefecture)} />
}

export default CityAreaPage
