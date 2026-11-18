import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf, type Pref } from './filters'

export function elderlyRatioConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の自治体の老年人口比率ランキング`,
    description: `${scope}の市区町村を65歳以上人口の比率の高い順に並べたランキング。`,
    columns: [
      { id: 1, label: '自治体名',        expression: '$kanji' },
      { id: 4, label: '老年人口比率(%)', expression: 'ROUND(#elderly_total / #totalpop * 100, 1)' },
      { id: 3, label: '65歳以上',        expression: '#elderly_total' },
      { id: 2, label: '総人口',          expression: '#totalpop' },
      ...(pref ? [] : [{ id: 0, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#elderly_total / #totalpop',
    sortDirection: 'desc',
  }
}

export default elderlyRatioConfig
