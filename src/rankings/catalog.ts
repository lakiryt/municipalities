// Every ranking page, in one place: the router makes a route of each, the
// home and prefecture pages list them by group, the carousel and the
// municipality page link to them by slug, and the sitemap lists them all.
import type { RankingConfig } from '../types'
import type { DataSelection } from '../data/datasets'
import type { Pref } from './filters'
import { municipalPopulationConfig, householdsConfig } from './municipalPopulation'
import { populationChangeConfig } from './populationChange'
import { cityPopulationConfig } from './cityPopulation'
import { townVillageConfig } from './townsVillages'
import { elderlyRatioConfig } from './elderlyRatio'
import { densityConfig } from './density'
import { areaConfig, cityAreaConfig } from './area'
import { rentConfig } from './rent'
import rentLaborDaysConfig from './rentLaborDays'
import { loveCompetitionConfig, pensionRentConfig, newcomersConfig, fromAbroadConfig, birthsConfig } from './life'
import { designatedCitiesConfig, coreCitiesConfig } from './designatedCities'
import populationOver500k from './populationOver500k'

export type CatalogEntry = {
  slug: string
  label: string
  // Also exists for each prefecture as /rankings/<pref>/<slug>; otherwise
  // national only (/rankings/all/<slug>).
  perPref: boolean
  // `pref` null = the whole country. The config may depend on データの選択
  // (e.g. the period 人口増減 compares).
  configFor: (pref: Pref | null, selection?: DataSelection) => RankingConfig
  // Opens with these query params (e.g. straight to its map).
  query?: string
  // Only for prefectures that have municipalities of this kind.
  needsKind?: '村'
}
export type CatalogGroup = { title: string; entries: CatalogEntry[] }

const national = (config: RankingConfig) => () => config

export const CATALOG: CatalogGroup[] = [
  {
    title: '人口',
    entries: [
      { slug: 'population', label: '市区町村の人口', perPref: true, configFor: municipalPopulationConfig },
      { slug: 'population-change', label: '人口増加率', perPref: true, configFor: (p, sel) => populationChangeConfig(p, 'growth', sel) },
      { slug: 'population-decline', label: '人口減少率', perPref: true, configFor: (p, sel) => populationChangeConfig(p, 'decline', sel) },
      { slug: 'cities', label: '市の人口', perPref: true, configFor: cityPopulationConfig },
      { slug: 'towns', label: '町の人口', perPref: true, configFor: p => townVillageConfig(p, '町') },
      { slug: 'villages', label: '村の人口', perPref: true, configFor: p => townVillageConfig(p, '村'), needsKind: '村' },
      { slug: 'households', label: '世帯数', perPref: true, configFor: householdsConfig },
      { slug: 'elderly-ratio', label: '老年人口比率', perPref: true, configFor: elderlyRatioConfig },
    ],
  },
  {
    title: '面積・人口密度',
    entries: [
      { slug: 'density', label: '人口密度', perPref: true, configFor: densityConfig },
      { slug: 'area', label: '面積', perPref: true, configFor: areaConfig },
      { slug: 'city-area', label: '市の面積', perPref: true, configFor: cityAreaConfig },
    ],
  },
  {
    title: '暮らし',
    entries: [
      { slug: 'rent', label: '家賃', perPref: true, configFor: rentConfig },
      { slug: 'rent-labor-days', label: '家賃を稼ぐのに必要な労働日数', perPref: false, configFor: national(rentLaborDaysConfig), query: '?map=@4' },
      { slug: 'pension-rent', label: '年金で家賃を払った残り', perPref: true, configFor: pensionRentConfig },
      { slug: 'love-competition-women', label: '恋愛競争率（女性から見て）', perPref: true, configFor: p => loveCompetitionConfig(p, 'women') },
      { slug: 'love-competition-men', label: '恋愛競争率（男性から見て）', perPref: true, configFor: p => loveCompetitionConfig(p, 'men') },
      { slug: 'newcomers', label: '転入者の割合（国内から）', perPref: true, configFor: newcomersConfig },
      { slug: 'from-abroad', label: '転入者の割合（国外から）', perPref: true, configFor: fromAbroadConfig },
      { slug: 'births', label: '生まれた赤ちゃんの数', perPref: true, configFor: birthsConfig },
    ],
  },
  {
    title: '一覧',
    entries: [
      { slug: 'designated-cities', label: '政令指定都市', perPref: false, configFor: national(designatedCitiesConfig) },
      { slug: 'core-cities', label: '中核市', perPref: false, configFor: national(coreCitiesConfig) },
      { slug: 'population-over-500k', label: '人口50万人以上の自治体', perPref: false, configFor: national(populationOver500k) },
    ],
  },
]

export const RANKINGS: CatalogEntry[] = CATALOG.flatMap(g => g.entries)

export function ranking(slug: string): CatalogEntry {
  const e = RANKINGS.find(r => r.slug === slug)
  if (!e) throw new Error(`no ranking "${slug}" in the catalog`)
  return e
}

/** The ranking's page; `withQuery` adds its opening params (e.g. ?map=@4). */
export const rankingPath = (e: CatalogEntry, pref = 'all', withQuery = true) =>
  `/rankings/${pref}/${e.slug}${withQuery ? (e.query ?? '') : ''}`

/** Which rankings a prefecture has (`kinds`: the kinds of municipality it has). */
export const prefRankings = (kinds: Set<string>) =>
  CATALOG.map(g => ({ ...g, entries: g.entries.filter(e => e.perPref && (!e.needsKind || kinds.has(e.needsKind))) }))
    .filter(g => g.entries.length > 0)
