// 47 prefectures as a tile grid map (13 columns × 10 rows): each prefecture
// one equal square, placed roughly where it lies. The same motif as the logo.
// Keyed by the 2-digit prefecture code.
export const PREF_TILES: Record<string, [col: number, row: number]> = {
  '01': [12, 0],
  '02': [12, 1],
  '05': [11, 2], '03': [12, 2],
  '06': [11, 3], '04': [12, 3],
  '17': [8, 4], '16': [9, 4], '15': [10, 4], '07': [11, 4],
  '32': [3, 5], '31': [4, 5], '28': [5, 5], '26': [6, 5], '18': [7, 5], '21': [8, 5], '20': [9, 5], '10': [10, 5], '09': [11, 5], '08': [12, 5],
  '42': [0, 6], '41': [1, 6], '40': [2, 6], '35': [3, 6], '34': [4, 6], '33': [5, 6], '27': [6, 6], '25': [7, 6], '23': [8, 6], '19': [9, 6], '11': [10, 6], '13': [11, 6], '12': [12, 6],
  '43': [1, 7], '44': [2, 7], '38': [4, 7], '37': [5, 7], '29': [6, 7], '24': [7, 7], '22': [9, 7], '14': [10, 7],
  '46': [1, 8], '45': [2, 8], '39': [4, 8], '36': [5, 8], '30': [6, 8],
  '47': [0, 9],
}
export const TILE_COLS = 13
export const TILE_ROWS = 10

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

/** 北海道 → 北海道, 東京都 → 東京, 大阪府 → 大阪 */
export const shortPrefName = (kanji: string) => (kanji === '北海道' ? kanji : kanji.replace(/[都府県]$/, ''))
