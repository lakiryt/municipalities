import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf, type Pref } from './filters'

// Every 市区町村 (市・町・村・特別区 together) by population — the ranking a
// municipality's 人口 rank refers to.
export function municipalPopulationConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の市区町村の人口ランキング`,
    description: `${scope}の市区町村を人口の多い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '総人口', expression: '#totalpop' },
      { id: 2, label: '種別', expression: '$kind' },
      ...(pref ? [] : [{ id: 3, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#totalpop',
    sortDirection: 'desc',
  }
}

export function householdsConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の市区町村の世帯数ランキング`,
    description: `${scope}の市区町村を世帯数の多い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '世帯数', expression: '#setai' },
      { id: 2, label: '1世帯あたり人数', expression: 'ROUND(#totalpop / #setai, 2)' },
      { id: 3, label: '総人口', expression: '#totalpop' },
      ...(pref ? [] : [{ id: 4, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#setai',
    sortDirection: 'desc',
  }
}
