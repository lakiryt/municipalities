import type { RankingConfig } from '../types'

type Pref = { kanji: string }

export function densityConfig(pref: Pref | null): RankingConfig {
  return {
    title: pref ? `${pref.kanji}の自治体 — 人口密度ランキング` : '全国の自治体 — 人口密度ランキング',
    description: pref
      ? `${pref.kanji}の市区町村を人口密度（人/km²）の高い順に並べたランキングです。`
      : '全国の市区町村を人口密度（人/km²）の高い順に並べたランキングです。',
    columns: [
      { label: '自治体名',         expression: '$kanji' },
      { label: '人口',             expression: '#totalpop' },
      { label: '面積(km²)',        expression: '#area' },
      { label: '人口密度(人/km²)', expression: 'ROUND(MULT(#totalpop, INV(#area)), 2)' },
    ],
    filterExpression: pref ? `EQ($prefkanji, "${pref.kanji}")` : undefined,
    sortExpression: 'MULT(#totalpop, INV(#area))',
    sortDirection: 'desc',
  }
}
