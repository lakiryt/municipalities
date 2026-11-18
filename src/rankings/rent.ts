import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf, type Pref } from './filters'

export function rentConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の自治体の民営借家の平均家賃（20㎡）ランキング`,
    description: `${scope}の市区町村を、民営借家に住む人が払っている家賃の平均（延べ面積20m²分。家賃0円の住宅を除く）が高い順に並べたランキングです。`,
    columns: [
      { id: 1, label: '自治体名', expression: '$kanji' },
      { id: 2, label: '民営借家の平均家賃（20㎡）', expression: '20 * #rent_private' },
      ...(pref ? [] : [{ id: 0, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '20 * #rent_private',
    sortDirection: 'desc',
  }
}

export default rentConfig
