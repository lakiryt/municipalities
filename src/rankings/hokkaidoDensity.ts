import type { RankingConfig } from '../types'

const hokkaidoDensity: RankingConfig = {
  title: '北海道 — 人口密度ランキング',
  columns: [
    { label: 'コード',     expression: '$code' },
    { label: '自治体名',   expression: '$kanji' },
    { label: '総人口',     expression: '#totalpop' },
    { label: '面積(km²)', expression: '#area' },
    { label: '人口密度',  expression: 'MULT(#totalpop, INV(#area))' },
  ],
  filterExpression: 'EQ($prefkanji, "北海道")',
  sortExpression: 'MULT(#totalpop, INV(#area))',
  sortDirection: 'desc',
}

export default hokkaidoDensity
