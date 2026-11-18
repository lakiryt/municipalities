import type { RankingConfig } from '../types'

const rentLaborDaysConfig: RankingConfig = {
  title: '全国の自治体の民営借家の平均家賃（30㎡）を稼ぐのに必要な最低賃金労働日数ランキング',
  description: '全国の市区町村を、地域別最低賃金で民営借家の平均家賃（延べ面積30m²分。家賃0円の住宅を除く）を稼ぐのに必要な労働日数（1日8時間換算）が多い順に並べたランキングです。',
  columns: [
    { id: 1, label: '自治体名', expression: '$kanji' },
    { id: 4, label: '民営借家の平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数', expression: 'ROUND(30 * #rent_private / (#minwage * 8), 2)' },
    { id: 2, label: '民営借家の平均家賃（30㎡）', expression: '30 * #rent_private' },
    { id: 3, label: '最低賃金', expression: '#minwage' },
    { id: 0, label: '都道府県', expression: '$prefkanji' },
  ],
  // The ranking is by working days, not by rent: the minimum wage differs
  // by prefecture, so the two orders differ.
  filterExpression: '&official',
  sortExpression: '30 * #rent_private / (#minwage * 8)',
  sortDirection: 'desc',
}

export default rentLaborDaysConfig
