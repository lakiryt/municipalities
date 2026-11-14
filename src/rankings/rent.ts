import type { RankingConfig } from '../types'

const rentConfig: RankingConfig = {
  title: '全国の自治体の平均家賃（20㎡）ランキング',
  description: '全国の市区町村を、延べ面積20m²あたりの家賃（家賃0円の住宅を除く）が高い順に並べたランキングです。',
  columns: [
    { id: 1, label: '自治体名', expression: '$kanji' },
    { id: 2, label: '平均家賃（20㎡）', expression: 'MULT(20, #rent_exc0)' },
    { id: 0, label: '都道府県', expression: '$prefkanji' },
  ],
  sortExpression: 'MULT(20, #rent_exc0)',
  sortDirection: 'desc',
}

export default rentConfig
