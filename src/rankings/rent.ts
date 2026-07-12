import type { RankingConfig } from '../types'

const rentConfig: RankingConfig = {
  title: '全国の自治体の平均家賃（20㎡）ランキング',
  description: '全国の市区町村を、延べ面積20m²あたりの家賃（家賃0円の住宅を除く）が高い順に並べたランキングです。',
  columns: [
    { label: '都道府県', expression: '$prefkanji' },
    { label: '自治体名', expression: '$kanji' },
    { label: '平均家賃（20㎡）', expression: 'MULT(20, #rent_exc0)' },
  ],
  sortExpression: 'MULT(20, #rent_exc0)',
  sortDirection: 'desc',
}

export default rentConfig
