// Every ranking page, grouped for the home page and the prefecture pages.
// `perPref`: also exists as /rankings/<pref>/… (otherwise national only).
export type CatalogEntry = { slug: string; label: string; perPref: boolean; query?: string }
export type CatalogGroup = { title: string; entries: CatalogEntry[] }

export const CATALOG: CatalogGroup[] = [
  {
    title: '人口',
    entries: [
      { slug: 'population', label: '市区町村の人口', perPref: true },
      { slug: 'population-change', label: '人口増加率', perPref: true },
      { slug: 'population-decline', label: '人口減少率', perPref: true },
      { slug: 'cities', label: '市の人口', perPref: true },
      { slug: 'towns', label: '町の人口', perPref: true },
      { slug: 'villages', label: '村の人口', perPref: true },
      { slug: 'households', label: '世帯数', perPref: true },
      { slug: 'elderly-ratio', label: '老年人口比率', perPref: true },
    ],
  },
  {
    title: '面積・人口密度',
    entries: [
      { slug: 'density', label: '人口密度', perPref: true },
      { slug: 'area', label: '面積', perPref: true },
      { slug: 'city-area', label: '市の面積', perPref: true },
    ],
  },
  {
    title: '暮らし',
    entries: [
      { slug: 'rent', label: '家賃', perPref: true },
      { slug: 'rent-labor-days', label: '家賃を稼ぐのに必要な労働日数', perPref: false, query: '?map=@4' },
      { slug: 'pension-rent', label: '年金で家賃を払った残り', perPref: true },
      { slug: 'love-competition-women', label: '恋愛競争率（女性から見て）', perPref: true },
      { slug: 'love-competition-men', label: '恋愛競争率（男性から見て）', perPref: true },
      { slug: 'newcomers', label: '転入者の割合', perPref: true },
    ],
  },
  {
    title: '一覧',
    entries: [
      { slug: 'designated-cities', label: '政令指定都市', perPref: false },
      { slug: 'core-cities', label: '中核市', perPref: false },
      { slug: 'population-over-500k', label: '人口50万人以上の自治体', perPref: false },
    ],
  },
]

export const rankingPath = (e: CatalogEntry, pref = 'all') => `/rankings/${pref}/${e.slug}${e.query ?? ''}`
