// What an expression evaluates to. A number is always finite: where there is
// no number, the value says why — never NaN or ±∞, which can't tell "the data
// has none" from "divided by zero" and which every consumer used to have to
// remember to check for.

declare const finiteBrand: unique symbol
/** A number that is neither NaN nor ±∞. */
export type Finite = number & { readonly [finiteBrand]: true }
export const asFinite = (v: number): Finite | undefined => (Number.isFinite(v) ? (v as Finite) : undefined)
export const ZERO = 0 as Finite

/**
 * Why there is no value:
 * - nodata:   the data has none for this place (`source` is the variable, e.g. "#rent_private")
 * - divzero:  a division by zero
 * - overflow: a result too large for a number
 */
export type Missing =
  | { readonly missing: 'nodata'; readonly source: string }
  | { readonly missing: 'divzero' }
  | { readonly missing: 'overflow' }

export const DIVZERO: Missing = { missing: 'divzero' }
export const OVERFLOW: Missing = { missing: 'overflow' }

const nodataBySource = new Map<string, Missing>()
/** The one `nodata` value for a variable (shared, so building an environment allocates nothing per row). */
export function nodata(source: string): Missing {
  let m = nodataBySource.get(source)
  if (!m) nodataBySource.set(source, m = { missing: 'nodata', source })
  return m
}

export type Num = Finite | Missing
export type Bool = boolean | Missing
export type Str = string | Missing
export type Value = Num | Bool | Str

export const isMissing = <T>(v: T | Missing): v is Missing =>
  typeof v === 'object' && v !== null && 'missing' in v

// When several operands are missing, the result is missing for the reason
// that ranks first — so `a + b` and `b + a` say the same thing. Missing data
// comes first: with it, whether the rest could be computed is beside the point.
const RANK: Record<Missing['missing'], number> = { nodata: 0, divzero: 1, overflow: 2 }
export const firstReason = (a: Missing | null, b: Missing): Missing =>
  a === null || RANK[b.missing] < RANK[a.missing] ? b : a

/** A computed number, or overflow when it isn't finite. */
export const checked = (v: number): Num => asFinite(v) ?? OVERFLOW

/** A number from the data (where NaN means "none"), as a value. */
export const fromData = (v: number | undefined, source: string): Num =>
  (v === undefined ? undefined : asFinite(v)) ?? nodata(source)
