'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface WarmthTrendChartProps {
  data: Array<{ month: string; avg_overall: number; response_count: number }>
}

export function WarmthTrendChart({ data }: WarmthTrendChartProps) {
  if (data.length === 0) return null
  return (
    <>
      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
        Tendencia últimos {data.length} meses
      </p>
      <div style={{ height: '12rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="month"
              tickFormatter={(m) => new Date(m).toLocaleDateString('es-MX', { month: 'short' })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
            />
            <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              itemStyle={{ color: 'hsl(var(--card-foreground))' }}
            />
            <Line type="monotone" dataKey="avg_overall" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
