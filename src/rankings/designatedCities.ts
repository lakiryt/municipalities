import type { RankingConfig } from '../types'
import { CENSUS_RATE } from './populationChange'
import { censusPeriod } from '../data/datasets'

// 政令指定都市・中核市の一覧（人口順）。「〇〇 一覧 人口」と探されるので、
// 一覧として必要な列（人口・増減・面積・人口密度・都道府県）をそろえる。
function listConfig(kind: 'seirei' | 'chukaku', name: string, intro: string): RankingConfig {
  return {
    title: `${name}一覧（人口順）`,
    description: `${intro}全${name}を人口の多い順に並べ、国勢調査による人口増減率（${censusPeriod()}）・面積・人口密度も載せています。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '総人口', expression: '#totalpop' },
      { id: 2, label: '人口増減率(%)', expression: CENSUS_RATE },
      { id: 3, label: '面積(km²)', expression: '#area' },
      { id: 4, label: '人口密度(人/km²)', expression: 'ROUND(MULT(#totalpop, INV(#area)), 1)' },
      { id: 5, label: '都道府県', expression: '$prefkanji' },
    ],
    filterExpression: `&${kind}`,
    sortExpression: '#totalpop',
    sortDirection: 'desc',
  }
}

export const designatedCitiesConfig = listConfig('seirei', '政令指定都市', '人口50万人以上で政令により指定された市（政令市）の一覧です。')
export const coreCitiesConfig = listConfig('chukaku', '中核市', '人口20万人以上で指定を受けた中核市の一覧です。')
