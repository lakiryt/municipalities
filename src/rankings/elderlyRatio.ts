import type { RankingConfig } from '../types'

const elderlyRatioConfig: RankingConfig = {
  title: '全国の自治体の老年人口比率ランキング',
  description: '全国の市区町村を65歳以上人口の比率の高い順に並べたランキングです。住民基本台帳の年齢別データが必要です。',
  columns: [
    { label: '都道府県',        expression: '$prefkanji' },
    { label: '自治体名',        expression: '$kanji' },
    { label: '総人口',          expression: '#totalpop' },
    { label: '65歳以上',        expression: '#elderly_total' },
    { label: '老年人口比率(%)', expression: 'ROUND(MULT(MULT(#elderly_total, INV(#totalpop)), 100), 1)' },
  ],
  sortExpression: 'MULT(#elderly_total, INV(#totalpop))',
  sortDirection: 'desc',
}

export default elderlyRatioConfig
