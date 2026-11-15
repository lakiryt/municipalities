import type { RankingConfig } from '../types'
import { OFFICIAL, inPref, allOf } from './filters'

type Pref = { kanji: string }

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
export const loveRatio = (side: LoveSide) => `MULT(${LOVE_SIDES[side].rivals}, INV(${LOVE_SIDES[side].partners}))`

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
    filterExpression: allOf(OFFICIAL, pref && inPref(pref), `LEQ(100, ${s.partners})`),
    sortExpression: loveRatio(side),
    sortDirection: 'desc',
  }
}

// 年金だけで暮らしたら、家賃を払っていくら残る？ — 国民年金（老齢基礎年金）
// の満額（2025年度・月額）から、30m²分の家賃を引いた額。
export const PENSION_MONTHLY = 69308
export const PENSION_LEFT = `SUM(${PENSION_MONTHLY}, NEG(MULT(30, #rent_exc0)))`
export function pensionRentConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の「年金で家賃を払った残り」ランキング（国民年金満額 − 30m²の家賃）`,
    description: `${scope}の市区町村を、国民年金の満額（月${PENSION_MONTHLY.toLocaleString('ja-JP')}円）から平均家賃（30m²）を払った残りの少ない順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '家賃を払った残り（円/月）', expression: `ROUND(${PENSION_LEFT}, 0)` },
      { id: 2, label: '平均家賃（30m²）', expression: 'ROUND(MULT(30, #rent_exc0), 0)' },
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
export const NEWCOMER_RATIO = 'ROUND(MULT(#inc_mov_dom, INV(#totalpop), 100), 2)'
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
    sortExpression: 'MULT(#inc_mov_dom, INV(#totalpop))',
    sortDirection: 'desc',
  }
}

// 世界中から、人がやってくるまち — 去年、国外から引っ越してきた人の割合。
export const FROM_ABROAD_RATIO = 'ROUND(MULT(#inc_mov_intl, INV(#totalpop), 100), 2)'
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
    sortExpression: 'MULT(#inc_mov_intl, INV(#totalpop))',
    sortDirection: 'desc',
  }
}

// 公園で、同じくらいの子に会える？ — 1km²あたりの0〜4歳の人数。
export const TODDLER_DENSITY = 'ROUND(MULT(#total0_4, INV(#area)), 1)'
export function toddlerDensityConfig(pref: Pref | null): RankingConfig {
  const scope = pref ? pref.kanji : '全国'
  return {
    title: `${scope}の0〜4歳の人口密度ランキング`,
    description: `${scope}の市区町村を、1km²あたりの0〜4歳の人数が多い順に並べたランキングです。`,
    columns: [
      { id: 0, label: '自治体名', expression: '$kanji' },
      { id: 1, label: '0〜4歳の人口密度（人/km²）', expression: TODDLER_DENSITY },
      { id: 2, label: '0〜4歳', expression: '#total0_4' },
      { id: 3, label: '面積(km²)', expression: '#area' },
      ...(pref ? [] : [{ id: 4, label: '都道府県', expression: '$prefkanji' }]),
    ],
    filterExpression: allOf(OFFICIAL, pref && inPref(pref)),
    sortExpression: 'MULT(#total0_4, INV(#area))',
    sortDirection: 'desc',
  }
}
