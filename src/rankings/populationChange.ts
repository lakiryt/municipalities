import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf, type Pref } from './filters'
import { selectedSource, defaultDataSelection, type DataSelection } from '../data/datasets'

// 人口増減: the two editions compared come from データの選択 (by default the
// last two 国勢調査), and the title and columns name that period. 増加率の
// 高い順（growth）と減少率の大きい順（decline）は検索のされ方が違うので別ページ。
export const CHANGE_RATE = 'ROUND(#pop_change_rate * 100, 2)'

/** "2020→2025年" for the selected (or default) comparison. */
export const changePeriod = (selection: DataSelection = defaultDataSelection()) =>
  selectedSource('change', selection)?.name ?? ''

export function populationChangeConfig(pref: Pref | null, order: 'growth' | 'decline', selection?: DataSelection): RankingConfig {
  const period = changePeriod(selection)
  const scope = pref ? pref.kanji : '全国'
  const what = order === 'growth' ? '人口増加率' : '人口減少率'
  const [y0, y1] = period.replace('年', '').split('→')
  // A zero (an evacuated town) or missing earlier count has no rate.
  const hasRate = '#pop_from >= 1'
  return {
    title: `${scope}の市区町村の${what}ランキング（${period}）`,
    description:
      `${scope}の市区町村を、${period}の人口の増減率が${order === 'growth' ? '高い' : '低い（減少の大きい）'}順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '人口増減率(%)', expression: CHANGE_RATE },
      { id: 2, label: '増減数', expression: '#pop_change' },
      { id: 3, label: `人口（${y1}年）`, expression: '#pop_to' },
      { id: 4, label: `人口（${y0}年）`, expression: '#pop_from' },
      ...(pref ? [] : [{ id: 5, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref), hasRate),
    sortExpression: '#pop_change_rate',
    sortDirection: order === 'growth' ? 'desc' : 'asc',
  }
}
