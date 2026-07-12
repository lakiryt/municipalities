import type { RankingConfig } from '../types'

const rentLaborDaysConfig: RankingConfig = {
  title: '全国の自治体の平均家賃（30㎡）を稼ぐのに必要な最低賃金労働日数ランキング',
  description: '全国の市区町村を、地域別最低賃金で延べ面積30m²の家賃（家賃0円の住宅を除く）を稼ぐのに必要な労働日数（1日8時間換算）が多い順に並べたランキングです。',
  columns: [
    { label: '都道府県', expression: '$prefkanji' },
    { label: '自治体名', expression: '$kanji' },
    { label: '平均家賃（30㎡）', expression: 'MULT(30, #rent_exc0)' },
    { label: '最低賃金', expression: '#minwage' },
    { label: '平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数', expression: 'ROUND(MULT(30,#rent_exc0,INV(MULT(#minwage,8))),2)' },
  ],
  sortExpression: 'MULT(20, #rent_exc0)',
  sortDirection: 'desc',
}

export default rentLaborDaysConfig
