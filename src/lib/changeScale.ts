// Classes for a population change rate (%), as on the home page's tile map.
// Growth is the brand navy; decline steps through one warm hue, lighter for
// a small decline and darker for a steep one. Classed (not continuous) so the
// legend reads as plain ranges, and each tile also prints its value — color
// is never the only cue.
export type ChangeClass = { label: string; min: number; fill: string; ink: string }

export const CHANGE_CLASSES: ChangeClass[] = [
  { label: '増加',       min: 0,         fill: '#2c4a7c', ink: '#ffffff' },
  { label: '0〜-2%',     min: -2,        fill: '#f8dccb', ink: '#3b1d0f' },
  { label: '-2〜-4%',    min: -4,        fill: '#f0b18e', ink: '#3b1d0f' },
  { label: '-4〜-6%',    min: -6,        fill: '#d9784f', ink: '#ffffff' },
  { label: '-6%より減少', min: -Infinity, fill: '#a3472a', ink: '#ffffff' },
]

export const NO_DATA = { fill: '#ecebe7', ink: '#57534e' }

export function changeClass(ratePercent: number): ChangeClass | undefined {
  if (Number.isNaN(ratePercent)) return undefined
  return CHANGE_CLASSES.find(c => ratePercent >= c.min)
}

/** +1.3% / -4.5% / — */
export const formatRate = (ratePercent: number, digits = 1) =>
  Number.isNaN(ratePercent) ? '—' : `${ratePercent > 0 ? '+' : ''}${ratePercent.toFixed(digits)}%`
