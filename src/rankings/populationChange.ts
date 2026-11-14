import type { RankingConfig } from '../types'
import { censusPeriod } from '../data/datasets'

type Pref = { kanji: string }

// 国勢調査 2 回分（直近と前回）の人口を比べる。増加率の高い順（growth）と、
// 減少率の大きい順（decline）は検索のされ方が違うので別のページにする。
export const CENSUS_RATE = 'ROUND(MULT(#census_change_rate, 100), 2)'

export function populationChangeConfig(pref: Pref | null, order: 'growth' | 'decline'): RankingConfig {
  const period = censusPeriod()
  const scope = pref ? pref.kanji : '全国'
  const what = order === 'growth' ? '人口増加率' : '人口減少率'
  const [y0, y1] = period.replace('年', '').split('→')
  // 前回の人口が 0（避難指示区域）や、区の再編で前回の値がない行は率が出ないので除く。
  const hasRate = 'LEQ(1, #census_prev)'
  return {
    title: `${scope}の市区町村の${what}ランキング（${period}）`,
    description:
      `${scope}の市区町村を、国勢調査の人口の${period}の増減率で${order === 'growth' ? '高い' : '低い（減少の大きい）'}順に並べたランキングです。` +
      '人口の少ない自治体は、わずかな増減でも率が大きく動きます。',
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '人口増減率(%)', expression: CENSUS_RATE },
      { id: 2, label: '増減数', expression: '#census_change' },
      { id: 3, label: `人口（${y1}年）`, expression: '#census_pop' },
      { id: 4, label: `人口（${y0}年）`, expression: '#census_prev' },
      ...(pref ? [] : [{ id: 5, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: pref ? `AND(${hasRate}, EQ($prefkanji, "${pref.kanji}"))` : hasRate,
    sortExpression: '#census_change_rate',
    sortDirection: order === 'growth' ? 'desc' : 'asc',
  }
}
