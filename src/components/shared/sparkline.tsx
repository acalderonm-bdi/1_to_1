interface SparklineProps {
  data: number[]
  color?: 'accent' | 'lime' | 'green' | 'amber' | 'red' | 'violet'
  height?: number
  ariaLabel?: string
}

const COLOR_MAP: Record<NonNullable<SparklineProps['color']>, { stroke: string; fillStart: string; fillEnd: string }> = {
  accent: { stroke: 'hsl(var(--primary))',     fillStart: 'hsl(var(--primary))',     fillEnd: 'hsl(var(--primary))' },
  lime:   { stroke: 'hsl(var(--success))',     fillStart: 'hsl(var(--success))',     fillEnd: 'hsl(var(--success))' },
  green:  { stroke: 'hsl(var(--success))',     fillStart: 'hsl(var(--success))',     fillEnd: 'hsl(var(--success))' },
  amber:  { stroke: 'hsl(var(--warning))',     fillStart: 'hsl(var(--warning))',     fillEnd: 'hsl(var(--warning))' },
  red:    { stroke: 'hsl(var(--destructive))', fillStart: 'hsl(var(--destructive))', fillEnd: 'hsl(var(--destructive))' },
  violet: { stroke: 'hsl(var(--primary))',     fillStart: 'hsl(var(--primary))',     fillEnd: 'hsl(var(--primary))' },
}

export function Sparkline({ data, color = 'accent', height = 38, ariaLabel }: SparklineProps) {
  if (data.length < 2) return null

  const w = 200
  const h = height
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (data.length - 1)

  const points = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (v - min) / range)
    return [x, y] as const
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${h} L ${points[0][0].toFixed(1)} ${h} Z`

  const c = COLOR_MAP[color]
  const gradId = `spark-grad-${color}-${data.length}`

  return (
    <div className="kpi__spark" aria-hidden={ariaLabel ? undefined : true} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.fillStart} stopOpacity="0.32" />
            <stop offset="100%" stopColor={c.fillEnd} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={c.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={c.stroke} />
      </svg>
    </div>
  )
}
