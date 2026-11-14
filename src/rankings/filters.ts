// Building blocks for the rankings' starting filters — ordinary expressions,
// shown in the filter chip and editable like any other.
type Pref = { kanji: string }

/** Actual 地方公共団体 only: no designated-city wards (they'd double-count their city). */
export const OFFICIAL = '&official'
export const inPref = (pref: Pref) => `EQ($prefkanji, "${pref.kanji}")`
export const ofKind = (kind: string) => `EQ($kind, "${kind}")`

/** AND of the given parts (falsy ones skipped); undefined when none. */
export function allOf(...parts: (string | false | null | undefined)[]): string | undefined {
  const p = parts.filter((x): x is string => !!x)
  return p.length === 0 ? undefined : p.length === 1 ? p[0] : `AND(${p.join(', ')})`
}
