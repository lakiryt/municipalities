// The figures a municipality's detail page shows, each with its national and
// in-prefecture rank. Expressions use the same language as the table's
// columns, so a figure means exactly what the matching column would.
import { parseAndTypeCheck, type TypedExpr } from '@/lang/expr'
import { evaluate } from '@/lang/evaluate'
import { baseItemEnv, type BaseItem } from './municipalities'
import type { DesignationSets } from './datasets'

export type Metric = {
  key: string
  label: string
  unit: string
  expr: string
  // Same value across a prefecture (最低賃金) — a municipal rank is meaningless.
  prefectureLevel?: boolean
  // The ranking this figure's rank refers to: /rankings/<pref or all>/<slug>.
  ranking?: string
}

export const DETAIL_METRICS: Metric[] = [
  { key: 'pop', label: '人口', unit: '人', expr: '#totalpop', ranking: 'population' },
  { key: 'setai', label: '世帯数', unit: '世帯', expr: '#setai', ranking: 'households' },
  { key: 'area', label: '面積', unit: 'km²', expr: '#area', ranking: 'area' },
  { key: 'density', label: '人口密度', unit: '人/km²', expr: 'ROUND(MULT(#totalpop, INV(#area)), 1)', ranking: 'density' },
  { key: 'elderly', label: '老年人口比率', unit: '%', expr: 'ROUND(MULT(#elderly_total, INV(#totalpop), 100), 1)', ranking: 'elderly-ratio' },
  // The period compared is the 人口増減 chosen in データの選択 (its chip says which).
  { key: 'change', label: '人口増減率', unit: '%', expr: 'ROUND(MULT(#pop_change_rate, 100), 2)', ranking: 'population-change' },
  { key: 'rent', label: '民営借家の家賃（1m²あたり）', unit: '円', expr: '#rent_private', ranking: 'rent' },
  { key: 'minwage', label: '最低賃金', unit: '円/時', expr: '#minwage', prefectureLevel: true },
]

const typed: Map<string, TypedExpr> = new Map(DETAIL_METRICS.map(m => [m.key, parseAndTypeCheck(m.expr)]))

export type MetricValue = {
  metric: Metric
  value: number
  national?: { rank: number; of: number }
  prefecture?: { rank: number; of: number }
}

/**
 * Values for `code`, ranked (highest first) among `ranked` — the official
 * municipalities, so designated-city wards and grouping rows never take a
 * place. A code that isn't itself ranked (a ward) gets values but no ranks.
 */
export function metricValues(
  code: string, items: BaseItem[], ranked: Set<string>, designations: DesignationSets | undefined, coastal: Set<string>,
): MetricValue[] {
  const target = items.find(i => i.code === code)
  if (!target) return []
  const pref = code.slice(0, 2)
  const pool = items.filter(i => ranked.has(i.code))
  const valueOf = (item: BaseItem, key: string) => evaluate(typed.get(key)!, baseItemEnv(item, designations, coastal)) as number

  return DETAIL_METRICS.map(metric => {
    const value = valueOf(target, metric.key)
    if (Number.isNaN(value) || metric.prefectureLevel || !ranked.has(code)) return { metric, value }
    const values = pool.map(i => ({ code: i.code, v: valueOf(i, metric.key) })).filter(x => !Number.isNaN(x.v))
    const rankIn = (list: { v: number }[]) => ({ rank: 1 + list.filter(x => x.v > value).length, of: list.length })
    return {
      metric, value,
      national: rankIn(values),
      prefecture: rankIn(values.filter(x => x.code.startsWith(pref))),
    }
  })
}

// Age brackets as in the 住民基本台帳 age table (population columns
// total0_4 … total100_, male…, female…).
export { AGE_BRACKETS } from '@/lang/variables'

export const ageLabel = (b: string) => b.endsWith('_') ? `${b.slice(0, -1)}歳以上` : `${b.replace('_', '〜')}歳`
