import { useState } from 'react'
import { AGE_BRACKETS, ageLabel } from '@/data/metrics'
import { useElementWidth } from '@/lib/useElementWidth'
import { CHART } from './chartStyle'

type Props = { population: Record<string, number> }

const ROW = 14          // row pitch: a 10px bar + 4px of air
const BAR = 10          // ≤ 24px thick
const LABEL_W = 64      // the age labels sit between the two halves
const TOP = 26          // room for the direct labels 男性 / 女性

// A bar growing left or right from a baseline at x0: square at the
// baseline, 4px rounded at the data end.
function barPath(x0: number, y: number, len: number, dir: 1 | -1) {
  if (len <= 0) return ''
  const r = Math.min(4, len, BAR / 2)
  const x1 = x0 + dir * len
  const s = dir === 1 ? 1 : 0
  return `M${x0},${y} H${x1 - dir * r} A${r},${r} 0 0 ${s} ${x1},${y + r} V${y + BAR - r} A${r},${r} 0 0 ${s} ${x1 - dir * r},${y + BAR} H${x0} Z`
}

// Population pyramid from the 住民基本台帳 age table: 男性 left (slot 1, blue),
// 女性 right (slot 2, orange), oldest at the top. Two series → a legend
// and direct labels; hover/tap a row for exact numbers; a table view below.
function AgePyramid({ population }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const rows = [...AGE_BRACKETS].reverse().map(b => ({
    b, male: population[`male${b}`] ?? NaN, female: population[`female${b}`] ?? NaN,
  }))
  if (rows.every(r => Number.isNaN(r.male))) return <p className="text-sm text-gray-500">選択中の人口データには年齢別の数値がありません（住民基本台帳を選ぶと表示されます）。</p>

  const total = rows.reduce((s, r) => s + r.male + r.female, 0)
  const max = Math.max(...rows.flatMap(r => [r.male, r.female]))
  const w = Math.max(300, width)
  const half = (w - LABEL_W) / 2
  const cxL = half, cxR = half + LABEL_W
  const len = (v: number) => (v / max) * (half - 8)
  const H = TOP + rows.length * ROW
  const hv = rows.find(r => r.b === hover)

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-4 text-xs text-gray-600 mb-1" aria-hidden>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHART.series1 }} />男性</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHART.series2 }} />女性</span>
      </div>
      <svg width={w} height={H} role="img" aria-label="年齢5歳階級別・男女別の人口ピラミッド（下に表あり）" onMouseLeave={() => setHover(null)}>
        <text x={cxL - 4} y={14} textAnchor="end" fontSize={12} fontWeight={600} fill={CHART.textPrimary}>男性</text>
        <text x={cxR + 4} y={14} fontSize={12} fontWeight={600} fill={CHART.textPrimary}>女性</text>
        {rows.map((r, i) => {
          const y = TOP + i * ROW + (ROW - BAR) / 2
          return (
            <g key={r.b} onMouseEnter={() => setHover(r.b)} onClick={() => setHover(r.b)}>
              {/* Hit target: the whole row, bigger than the bars. */}
              <rect x={0} y={TOP + i * ROW} width={w} height={ROW} fill={hover === r.b ? '#f3f2ef' : 'transparent'} />
              <path d={barPath(cxL, y, len(r.male), -1)} fill={CHART.series1} />
              <path d={barPath(cxR, y, len(r.female), 1)} fill={CHART.series2} />
              <text x={w / 2} y={y + BAR / 2} dy="0.32em" textAnchor="middle" fontSize={10} fill={CHART.textSecondary}>
                {r.b.endsWith('_') ? `${r.b.slice(0, -1)}+` : r.b.replace('_', '–')}
              </text>
            </g>
          )
        })}
      </svg>
      {hv && (
        <div
          data-testid="pyramid-tooltip"
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap tabular-nums"
          style={{ left: 8, top: TOP + rows.indexOf(hv) * ROW + 30 }}
        >
          {ageLabel(hv.b)}：男性 {hv.male.toLocaleString('ja-JP')}人・女性 {hv.female.toLocaleString('ja-JP')}人
          （計の{(((hv.male + hv.female) / total) * 100).toFixed(1)}%）
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-blue-600 text-xs">表で見る</summary>
        <table className="mt-2 text-xs tabular-nums">
          <thead><tr className="text-gray-500"><th className="text-left pr-4 font-normal">年齢</th><th className="text-right pr-4 font-normal">男性</th><th className="text-right pr-4 font-normal">女性</th><th className="text-right font-normal">計</th></tr></thead>
          <tbody>
            {[...rows].reverse().map(r => (
              <tr key={r.b}><td className="pr-4">{ageLabel(r.b)}</td><td className="text-right pr-4">{r.male.toLocaleString('ja-JP')}</td><td className="text-right pr-4">{r.female.toLocaleString('ja-JP')}</td><td className="text-right">{(r.male + r.female).toLocaleString('ja-JP')}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export default AgePyramid
