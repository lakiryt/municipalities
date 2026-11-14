import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, ofKind, allOf } from './filters'

type Pref = { kanji: string }

export function areaConfig(pref: Pref | null): RankingConfig {
  return {
    title: pref ? `${pref.kanji}の自治体の面積ランキング` : '全国の自治体の面積ランキング',
    description: pref
      ? `${pref.kanji}の市区町村を面積（km²）の広い順に並べたランキングです。`
      : '全国の市区町村を面積（km²）の広い順に並べたランキングです。',
    columns: [
      { label: '自治体名',   expression: '$kanji' },
      { label: '面積(km²)', expression: '#area' },
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#area',
    sortDirection: 'desc',
  }
}

export function cityAreaConfig(pref: Pref | null): RankingConfig {
  return {
    title: pref ? `${pref.kanji}の市の面積ランキング` : '全国の市の面積ランキング',
    description: pref
      ? `${pref.kanji}の市を面積（km²）の広い順に並べたランキングです。`
      : '全国の市を面積（km²）の広い順に並べたランキングです。',
    columns: [
      { id: 1, label: '自治体名', expression: '$kanji' },
      { id: 2, label: '面積(km²)', expression: '#area' },
      { id: 0, label: '都道府県', expression: '$prefkanji' },
    ],
    filterExpression: allOf(ofKind('市'), pref && inPref(pref)),
    sortExpression: '#area',
    sortDirection: 'desc',
  }
}
