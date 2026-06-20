import type { RankingConfig } from '../types'

const populationOver500k: RankingConfig = {
  title: '人口50万人以上の自治体',
  columns: [
    { label: 'コード',   expression: '$code' },
    { label: '都道府県', expression: '$prefkanji' },
    { label: '自治体名', expression: '$kanji' },
    { label: '総人口',   expression: '#totalpop' },
  ],
  filterExpression: 'LEQ(500000, #totalpop)',
  sortExpression: '#totalpop',
  sortDirection: 'desc',
}

export default populationOver500k
