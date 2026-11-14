import type { RankingConfig } from '../types'
import { inPref, ofKind, allOf } from './filters'

type Pref = { kanji: string }

// 「〇〇県 町 人口 ランキング」「村 人口 少ない」向け: 町だけ・村だけの人口順。
export function townVillageConfig(pref: Pref | null, kind: '町' | '村'): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の${kind}の人口ランキング`,
    description: `${scope}の${kind}を人口の多い順に並べたランキング。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '総人口', expression: '#totalpop' },
      { id: 2, label: '面積(km²)', expression: '#area' },
      ...(pref ? [] : [{ id: 3, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(ofKind(kind), pref && inPref(pref)),
    sortExpression: '#totalpop',
    sortDirection: 'desc',
  }
}
