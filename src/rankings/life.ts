import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf, type Pref } from './filters'

// Rankings that start from a question someone asks at a turn in their life,
// computed from the same data as everything else.

// 恋人を探すなら、ライバルは何人？ — a few years' age gap, seen from either
// side: women 20〜24 per man 25〜29 (for women), or the other way round
// (for men). A small town can have a handful of people in the bracket, so
// the starting filter needs at least 100 of the other side (visible, and
// removable like any filter).
const LOVE_SIDES = {
  women: { rivals: '#female20_24', partners: '#male25_29', rivalLabel: '20〜24歳の女性', partnerLabel: '25〜29歳の男性', seenBy: '女性', per: '男性1人あたりの女性' },
  men:   { rivals: '#male25_29', partners: '#female20_24', rivalLabel: '25〜29歳の男性', partnerLabel: '20〜24歳の女性', seenBy: '男性', per: '女性1人あたりの男性' },
}
export type LoveSide = keyof typeof LOVE_SIDES
export const loveRatio = (side: LoveSide) => `${LOVE_SIDES[side].rivals} / ${LOVE_SIDES[side].partners}`

export function loveCompetitionConfig(pref: Pref | null, side: LoveSide): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  const s = LOVE_SIDES[side]
  return {
    title: `${scope}の恋愛競争率ランキング（${s.seenBy}から見て：${s.rivalLabel} ÷ ${s.partnerLabel}）`,
    description: `${scope}の市区町村を、${s.partnerLabel}1人に対する${s.rivalLabel}の人数が多い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: `競争率（${s.per}）`, expression: `ROUND(${loveRatio(side)}, 2)` },
      { id: 2, label: s.rivalLabel, expression: s.rivals },
      { id: 3, label: s.partnerLabel, expression: s.partners },
      ...(pref ? [] : [{ id: 4, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref), `${s.partners} >= 100`),
    sortExpression: loveRatio(side),
    sortDirection: 'desc',
  }
}

// 年金だけで暮らしたら、家賃を払っていくら残る？ — 国民年金（老齢基礎年金）
// の満額（2025年度・月額）から、30m²分の家賃を引いた額。
export const PENSION_MONTHLY = 69308
export const PENSION_LEFT = `${PENSION_MONTHLY} - 30 * #rent_private`
export function pensionRentConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の「年金で家賃を払った残り」ランキング（国民年金満額 − 30m²の家賃）`,
    description: `${scope}の市区町村を、国民年金の満額（月${PENSION_MONTHLY.toLocaleString('ja-JP')}円）から民営借家の平均家賃（30m²分）を払った残りの少ない順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '家賃を払った残り（円/月）', expression: `ROUND(${PENSION_LEFT}, 0)` },
      { id: 2, label: '民営借家の平均家賃（30m²）', expression: 'ROUND(30 * #rent_private, 0)' },
      ...(pref ? [] : [{ id: 3, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: PENSION_LEFT,
    sortDirection: 'asc',
  }
}

// よそ者でも、なじめるまち — 去年、国内から引っ越してきた人の割合。
// Arrivals from abroad are their own ranking (below): in ski resorts and
// farming villages they are mostly seasonal workers who leave again within
// the year, a different story from settling in.
export const NEWCOMER_RATIO = 'ROUND(#inc_mov_dom / #totalpop * 100, 2)'
export function newcomersConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の転入者の割合ランキング（去年国内から引っ越してきた人 ÷ 人口）`,
    description: `${scope}の市区町村を、去年1年間に国内から転入した人の、人口に対する割合が高い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '転入者の割合(%)', expression: NEWCOMER_RATIO },
      { id: 2, label: '転入者数（国内から）', expression: '#inc_mov_dom' },
      { id: 3, label: '総人口', expression: '#totalpop' },
      ...(pref ? [] : [{ id: 4, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#inc_mov_dom / #totalpop',
    sortDirection: 'desc',
  }
}

// 世界中から、人がやってくるまち — 去年、国外から引っ越してきた人の割合。
export const FROM_ABROAD_RATIO = 'ROUND(#inc_mov_intl / #totalpop * 100, 2)'
export function fromAbroadConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の国外からの転入者の割合ランキング（去年国外から引っ越してきた人 ÷ 人口）`,
    description: `${scope}の市区町村を、去年1年間に国外から転入した人の、人口に対する割合が高い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '国外からの転入者の割合(%)', expression: FROM_ABROAD_RATIO },
      { id: 2, label: '転入者数（国外から）', expression: '#inc_mov_intl' },
      { id: 3, label: '転出者数（国外へ）', expression: '#dec_mov_intl' },
      { id: 4, label: '総人口', expression: '#totalpop' },
      ...(pref ? [] : [{ id: 5, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: '#inc_mov_intl / #totalpop',
    sortDirection: 'desc',
  }
}

// この子の同級生は、何人になる？ — 去年1年間に生まれた赤ちゃんの数（住民
// 票の出生届）, fewest first: close to the size of that child's school year.
// The 北方領土 villages are 地方公共団体 with no residents; they're left out
// by needing someone to live there.
export function birthsConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の1年間に生まれた赤ちゃんの数ランキング（少ない順）`,
    description: `${scope}の市区町村を、去年1年間の出生数が少ない順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '出生数（去年1年間）', expression: '#inc_born' },
      { id: 2, label: '0〜4歳', expression: '#total0_4' },
      { id: 3, label: '総人口', expression: '#totalpop' },
      ...(pref ? [] : [{ id: 4, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref), '#totalpop >= 1'),
    sortExpression: '#inc_born',
    sortDirection: 'asc',
  }
}
