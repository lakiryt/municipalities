import type { RankingConfig } from '../types'
import { populationChangeConfig, changePeriod } from './populationChange'
import rentLaborDaysConfig from './rentLaborDays'
import { loveCompetitionConfig, pensionRentConfig, newcomersConfig, fromAbroadConfig, birthsConfig, PENSION_MONTHLY } from './life'

// The home page's carousel: rankings picked for the question behind them —
// something a person wonders about at a turn in their life. Each slide is an
// ordinary ranking (its config, its own map column), nothing computed apart.
export type Featured = {
  question: string
  // What the number is, in a line.
  note: string
  config: RankingConfig
  path: string
  // The column drawn on the map (its `@id`) and how its values read.
  mapColumn: number
  unit: string
}

export function featuredRankings(): Featured[] {
  return [
    {
      question: 'この5年で、まちの人口はどれだけ減った？',
      note: `国勢調査（${changePeriod()}）の人口増減率`,
      config: populationChangeConfig(null, 'decline'),
      path: '/rankings/all/population-decline',
      mapColumn: 1,
      unit: '%',
    },
    {
      question: '家賃を払うには、月に何日働けばいい？',
      note: '最低賃金で1日8時間働いて、30m²の平均家賃を稼ぐのに要る日数',
      config: rentLaborDaysConfig,
      path: '/rankings/all/rent-labor-days',
      mapColumn: 4,
      unit: '日',
    },
    {
      question: 'よそ者でも、なじめるまちは？',
      note: '去年1年間に国内から引っ越してきた人の、人口に対する割合',
      config: newcomersConfig(null),
      path: '/rankings/all/newcomers',
      mapColumn: 1,
      unit: '%',
    },
    {
      question: '世界中から、人がやってくるまちは？',
      note: '去年1年間に国外から引っ越してきた人の、人口に対する割合',
      config: fromAbroadConfig(null),
      path: '/rankings/all/from-abroad',
      mapColumn: 1,
      unit: '%',
    },
    {
      question: '年上の彼を探すなら、ライバルは何人？',
      note: '25〜29歳の男性1人あたりの、20〜24歳の女性の人数',
      config: loveCompetitionConfig(null, 'women'),
      path: '/rankings/all/love-competition-women',
      mapColumn: 1,
      unit: '人',
    },
    {
      question: '年下の彼女を探すなら、ライバルは何人？',
      note: '20〜24歳の女性1人あたりの、25〜29歳の男性の人数',
      config: loveCompetitionConfig(null, 'men'),
      path: '/rankings/all/love-competition-men',
      mapColumn: 1,
      unit: '人',
    },
    {
      question: 'この子の同級生は、何人になる？',
      note: '去年1年間に生まれた赤ちゃんの数（少ない順）',
      config: birthsConfig(null),
      path: '/rankings/all/births',
      mapColumn: 1,
      unit: '人',
    },
    {
      question: '年金だけで暮らしたら、家賃を払っていくら残る？',
      note: `国民年金の満額（月${PENSION_MONTHLY.toLocaleString('ja-JP')}円）から、30m²の平均家賃を引いた額`,
      config: pensionRentConfig(null),
      path: '/rankings/all/pension-rent',
      mapColumn: 1,
      unit: '円',
    },
  ]
}
