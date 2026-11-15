import type { RankingConfig } from '../types'
import { changePeriod } from './populationChange'
import { PENSION_MONTHLY } from './life'
import { ranking, rankingPath } from './catalog'

// The home page's carousel: rankings picked for the question behind them —
// something a person wonders about at a turn in their life. Each slide is an
// ordinary ranking from the catalog (its national config, its own map
// column), nothing computed apart.
export type Featured = {
  question: string
  // What the number is, in a line.
  note: string
  config: RankingConfig
  // The national ranking's page (without its opening params).
  path: string
  // The column drawn on the map (its `@id`) and how its values read.
  mapColumn: number
  unit: string
}

type Pick = { slug: string; question: string; note: string; mapColumn: number; unit: string }

const PICKS = (): Pick[] => [
  { slug: 'population-decline', question: 'この5年で、まちの人口はどれだけ減った？',
    note: `国勢調査（${changePeriod()}）の人口増減率`, mapColumn: 1, unit: '%' },
  { slug: 'rent-labor-days', question: '家賃を払うには、月に何日働けばいい？',
    note: '最低賃金で1日8時間働いて、民営借家の平均家賃（30m²分）を稼ぐのに要る日数', mapColumn: 4, unit: '日' },
  { slug: 'newcomers', question: 'よそ者でも、なじめるまちは？',
    note: '去年1年間に国内から引っ越してきた人の、人口に対する割合', mapColumn: 1, unit: '%' },
  { slug: 'from-abroad', question: '世界中から、人がやってくるまちは？',
    note: '去年1年間に国外から引っ越してきた人の、人口に対する割合', mapColumn: 1, unit: '%' },
  { slug: 'love-competition-women', question: '年上の彼を探すなら、ライバルは何人？',
    note: '25〜29歳の男性1人あたりの、20〜24歳の女性の人数', mapColumn: 1, unit: '人' },
  { slug: 'love-competition-men', question: '年下の彼女を探すなら、ライバルは何人？',
    note: '20〜24歳の女性1人あたりの、25〜29歳の男性の人数', mapColumn: 1, unit: '人' },
  { slug: 'births', question: 'この子の同級生は、何人になる？',
    note: '去年1年間に生まれた赤ちゃんの数（少ない順）', mapColumn: 1, unit: '人' },
  { slug: 'pension-rent', question: '年金だけで暮らしたら、家賃を払っていくら残る？',
    note: `国民年金の満額（月${PENSION_MONTHLY.toLocaleString('ja-JP')}円）から、民営借家の平均家賃（30m²分）を引いた額`, mapColumn: 1, unit: '円' },
]

export function featuredRankings(): Featured[] {
  return PICKS().map(({ slug, ...pick }) => {
    const entry = ranking(slug)
    return { ...pick, config: entry.configFor(null), path: rankingPath(entry, 'all', false) }
  })
}
