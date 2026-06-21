import { useParams } from 'react-router-dom'
import { prefectures } from '../../data/municipalities'
import { cityPopulationConfig } from '../../rankings/cityPopulation'
import RankingPage from './RankingPage'

function CityPopulationPage() {
  const { pref } = useParams<{ pref: string }>()
  const prefecture = pref === 'all'
    ? null
    : (prefectures.find(p => p.romanized === pref) ?? null)
  return <RankingPage config={cityPopulationConfig(prefecture)} />
}

export default CityPopulationPage
