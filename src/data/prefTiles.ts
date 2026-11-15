// 地方区分 (by prefecture code), for listing prefectures in groups.
export const REGIONS: { name: string; from: number; to: number }[] = [
  { name: '北海道・東北', from: 1, to: 7 },
  { name: '関東', from: 8, to: 14 },
  { name: '中部', from: 15, to: 23 },
  { name: '近畿', from: 24, to: 30 },
  { name: '中国', from: 31, to: 35 },
  { name: '四国', from: 36, to: 39 },
  { name: '九州・沖縄', from: 40, to: 47 },
]
