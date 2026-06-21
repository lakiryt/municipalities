import type { RankingConfig } from '../types'

type Pref = { kanji: string }

const KUBUN = 'IF(&seirei, "政令指定都市", IF(&chukaku, "中核市", IF(&tokurei, "施行時特例市", "")))'

export function cityPopulationConfig(pref: Pref | null): RankingConfig {
  const cityFilter = 'EQ(SUBSTR($kanji, NEG(1)), "市")'
  const filterExpression = pref
    ? `AND(${cityFilter}, EQ($prefkanji, "${pref.kanji}"))`
    : cityFilter

  return {
    title: pref ? `${pref.kanji}の市 — 人口ランキング` : '全国の市 — 人口ランキング',
    description: pref
      ? `${pref.kanji}の市を人口の多い順に並べたランキングです。政令指定都市・中核市・施行時特例市の区分も表示しています。`
      : '全国の市を人口の多い順に並べたランキングです。政令指定都市・中核市・施行時特例市の区分も表示しています。',
    columns: [
      { label: '都道府県', expression: '$prefkanji' },
      { label: '自治体名', expression: '$kanji' },
      { label: '区分',     expression: KUBUN },
      { label: '総人口',   expression: '#totalpop' },
    ],
    filterExpression,
    sortExpression: '#totalpop',
    sortDirection: 'desc',
  }
}
