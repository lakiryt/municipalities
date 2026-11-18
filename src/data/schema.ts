// Which variables the data selected in データの選択 can provide. Every number
// an expression reads comes from one column of one selectable dataset; an
// edition lists its columns (meta.json, read by the pipeline from the file),
// so whether a variable is there is known before any data is fetched — a
// 国勢調査 edition has no age brackets, and an expression using one is
// rejected up front instead of turning into a column of データなし.
import { POPULATION_VARS, DATA_VARS, recordOf, type NumVarName, type PopulationVar } from '@/lang/variables'
import { DERIVED_DEFS } from '@/lang/derived'
import { variablesOf, type TypedExpr } from '@/lang/expr'
import {
  SELECTABLE, DATA_KEYS, selectedSource, AREA_COLUMN, RENT_COLUMNS, MINWAGE_COLUMN, CHANGE_COLUMN,
  type DataKey, type DataSelection, type Source,
} from './datasets'

type DataVar = PopulationVar | typeof DATA_VARS[number]

// Where each variable read from data comes from (a new variable doesn't
// compile until it's listed here).
const COLUMN_OF: Record<DataVar, { key: DataKey; column: string }> = {
  ...recordOf(POPULATION_VARS, v => ({ key: 'pop' as const, column: v })),
  area:         { key: 'area', column: AREA_COLUMN },
  rent_inc0:    { key: 'rent', column: RENT_COLUMNS.inc0 },
  rent_exc0:    { key: 'rent', column: RENT_COLUMNS.exc0 },
  rent_private: { key: 'rent', column: RENT_COLUMNS.private },
  minwage:      { key: 'minwage', column: MINWAGE_COLUMN },
  pop_from:     { key: 'change', column: CHANGE_COLUMN },
  pop_to:       { key: 'change', column: CHANGE_COLUMN },
}
const isDataVar = (v: NumVarName): v is DataVar => v in COLUMN_OF

/** The dataset a variable read from data comes from; undefined for a derived one. */
export const datasetOf = (v: NumVarName): DataKey | undefined => (isDataVar(v) ? COLUMN_OF[v].key : undefined)

/**
 * Why a variable can't be used with the selected data: `missing` is the
 * variable read from data that isn't there (the variable itself, or for a
 * derived one, one it is computed from), `source` the edition lacking it
 * (undefined when the dataset has no edition at all).
 */
export type Unavailable = { variable: NumVarName; missing: DataVar; key: DataKey; source: Source | undefined }

/** The variables the selected data can't provide (all others it can). */
export type Scope = ReadonlyMap<NumVarName, Unavailable>

/** No restriction: every variable is there (checking expressions on their own). */
export const ANY_DATA: Scope = new Map()

export function scopeOf(selection: DataSelection): Scope {
  const out = new Map<NumVarName, Unavailable>()
  for (const v of POPULATION_VARS) check(v)
  for (const v of DATA_VARS) check(v)
  // In definition order, so each derived variable's inputs are already settled.
  for (const d of DERIVED_DEFS) {
    const why = [...variablesOf(d.typed).num].map(v => out.get(v)).find(u => u !== undefined)
    if (why) out.set(d.name, { ...why, variable: d.name })
  }
  return out

  function check(v: DataVar) {
    const { key, column } = COLUMN_OF[v]
    const source = selectedSource(key, selection)
    if (!source?.columns.has(column)) out.set(v, { variable: v, missing: v, key, source })
  }
}

/** The variables `expressions` use that `scope` lacks, one entry each. */
export function unavailableIn(expressions: (TypedExpr | null | undefined)[], scope: Scope): Unavailable[] {
  if (scope.size === 0) return []
  const used = new Set<NumVarName>()
  for (const t of expressions) if (t) for (const v of variablesOf(t).num) used.add(v)
  return [...used].flatMap(v => scope.get(v) ?? [])
}

const sourceName = (s: Source) => `「${s.label} ${s.name}」`

export function unavailableMessage(u: Unavailable): string {
  if (!u.source) return `${SELECTABLE[u.key].title}データがないため #${u.variable} は使えません`
  return u.variable === u.missing
    ? `${sourceName(u.source)}には #${u.missing} がありません`
    : `${sourceName(u.source)}には #${u.variable} の計算に使う #${u.missing} がありません`
}

/**
 * The selection with each dataset whose chosen edition lacks something the
 * expressions use switched to the first edition that has it (the default,
 * usually) — for a URL that picks an edition a page's fixed expressions
 * can't use. Datasets that are fine keep their choice.
 */
export function fitSelection(selection: DataSelection, expressions: (TypedExpr | null | undefined)[]): DataSelection {
  const lacking = new Set(unavailableIn(expressions, scopeOf(selection)).map(u => u.key))
  if (lacking.size === 0) return selection
  const out = { ...selection }
  for (const k of DATA_KEYS) {
    if (!lacking.has(k)) continue
    const fits = SELECTABLE[k].sources.find(s =>
      !unavailableIn(expressions, scopeOf({ ...out, [k]: s.path })).some(u => u.key === k))
    if (fits) out[k] = fits.path
  }
  return out
}
