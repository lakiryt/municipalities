import type { RankingConfig } from '../types'

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
    filterExpression: pref ? `EQ($prefkanji, "${pref.kanji}")` : undefined,
    sortExpression: '#area',
    sortDirection: 'desc',
  }
}

export function cityAreaConfig(pref: Pref | null): RankingConfig {
  const cityFilter = 'EQ(SUBSTR($kanji, NEG(1)), "市")'
  const filterExpression = pref
    ? `AND(${cityFilter}, EQ($prefkanji, "${pref.kanji}"))`
    : cityFilter

  return {
    title: pref ? `${pref.kanji}の市の面積ランキング` : '全国の市の面積ランキング',
    description: pref
      ? `${pref.kanji}の市を面積（km²）の広い順に並べたランキングです。`
      : '全国の市を面積（km²）の広い順に並べたランキングです。',
    columns: [
      { label: '都道府県', expression: '$prefkanji' },
      { label: '自治体名', expression: '$kanji' },
      { label: '面積(km²)', expression: '#area' },
    ],
    filterExpression,
    sortExpression: '#area',
    sortDirection: 'desc',
  }
}
