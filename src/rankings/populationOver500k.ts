import type { RankingConfig } from '../types'

const populationOver500k: RankingConfig = {
  title: '人口50万人以上の自治体一覧',
  description: '総人口が50万人以上の市区町村の一覧です。',
  columns: [
    { id: 2, label: '自治体名', expression: '$kanji' },
    { id: 3, label: '総人口',   expression: '#totalpop' },
    { id: 1, label: '都道府県', expression: '$prefkanji' },
    { id: 0, label: '自治体コード',   expression: '$code' },
  ],
  filterExpression: 'AND(&official, LEQ(500000, #totalpop))',
  sortExpression: '#totalpop',
  sortDirection: 'desc',
}

export default populationOver500k
