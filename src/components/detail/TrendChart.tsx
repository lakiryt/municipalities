import { useState } from 'react'
import type { SeriesPoint } from '@/data/datasets'
import { useElementWidth } from '@/lib/useElementWidth'
import { CHART, compactJa, niceTicks } from './chartStyle'

type Props = { points: SeriesPoint[] }

const H = 220
const M = { top: 20, right: 64, bottom: 28, left: 52 }

// Population by year (住民基本台帳, each January 1): one series, so no legend —
// the section heading names it. 2px line, end dot with a surface ring, direct
// labels on the first and last points only, hairline grid, and a crosshair
// tooltip on hover/tap. The y axis is fitted to the data (not from zero):
// year-to-year change is the point, and the axis labels say where it sits.
function TrendChart({ points }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return <p className="text-sm text-gray-500">推移を表示できる年が足りません。</p>

  const vs = points.map(p => p.totalpop)
  const pad = (Math.max(...vs) - Math.min(...vs)) * 0.15 || Math.max(...vs) * 0.05
  const ticks = niceTicks(Math.min(...vs) - pad, Math.max(...vs) + pad)
  const yLo = Math.min(ticks[0], Math.min(...vs)), yHi = Math.max(ticks.at(-1)!, Math.max(...vs))
  const w = Math.max(280, width)
  const x = (i: number) => M.left + (i / (points.length - 1)) * (w - M.left - M.right)
  const y = (v: number) => M.top + (1 - (v - yLo) / (yHi - yLo)) * (H - M.top - M.bottom)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.totalpop)}`).join('')
  const last = points.length - 1
  const step = w < 420 && points.length > 6 ? 2 : 1

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left
    const i = Math.round(((px - M.left) / (w - M.left - M.right)) * last)
    setHover(Math.max(0, Math.min(last, i)))
  }
  const h = hover !== null ? points[hover] : null
  const prev = hover !== null && hover > 0 ? points[hover - 1] : null

  return (
    <div ref={ref} className="relative">
      <svg
        width={w} height={H} role="img"
        aria-label={`人口の推移：${points[0].id}年 ${points[0].totalpop.toLocaleString('ja-JP')}人 → ${points[last].id}年 ${points[last].totalpop.toLocaleString('ja-JP')}人`}
        onMouseMove={e => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setHover(null)}
        onClick={e => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.textSecondary}>{compactJa(t)}</text>
          </g>
        ))}
        {points.map((p, i) => i % step === 0 || i === last ? (
          <text key={p.id} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={CHART.textSecondary}>{p.id}</text>
        ) : null)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} stroke={CHART.textSecondary} strokeWidth={1} opacity={0.4} />}
        <path d={line} fill="none" stroke={CHART.series1} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Direct labels: first and last values only. */}
        <text x={x(0)} y={y(points[0].totalpop) - 10} textAnchor="start" fontSize={11} fill={CHART.textSecondary}>{compactJa(points[0].totalpop)}</text>
        <text x={x(last) + 10} y={y(points[last].totalpop)} dy="0.32em" fontSize={12} fontWeight={600} fill={CHART.textPrimary}>{compactJa(points[last].totalpop)}</text>
        <circle cx={x(last)} cy={y(points[last].totalpop)} r={4} fill={CHART.series1} stroke={CHART.surface} strokeWidth={2} />
        {hover !== null && hover !== last && (
          <circle cx={x(hover)} cy={y(points[hover].totalpop)} r={4} fill={CHART.series1} stroke={CHART.surface} strokeWidth={2} />
        )}
      </svg>
      {h && (
        <div
          data-testid="trend-tooltip"
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap tabular-nums"
          style={{ left: Math.min(x(hover!) + 8, w - 170), top: 0 }}
        >
          {h.id}年1月1日：{h.totalpop.toLocaleString('ja-JP')}人
          {prev && `（前年比 ${(((h.totalpop - prev.totalpop) / prev.totalpop) * 100).toLocaleString('ja-JP', { maximumFractionDigits: 2, signDisplay: 'always' })}%）`}
        </div>
      )}
    </div>
  )
}

export default TrendChart
