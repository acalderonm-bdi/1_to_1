interface WarmthCell {
  label: string
  avg: number
  count: number
}

interface WarmthHeatmapProps {
  rows: WarmthCell[]
  title: string
  description: string
}

function cellTone(avg: number): { bg: string; fg: string } {
  if (avg >= 4) return { bg: 'hsl(var(--success) / 0.25)', fg: 'hsl(var(--success-foreground, 0 0% 10%))' }
  if (avg >= 3) return { bg: 'hsl(var(--warning) / 0.25)', fg: 'hsl(var(--warning-foreground, 0 0% 10%))' }
  return { bg: 'hsl(var(--destructive) / 0.25)', fg: 'hsl(var(--destructive-foreground, 0 0% 10%))' }
}

export function WarmthHeatmap({ rows, title, description }: WarmthHeatmapProps) {
  return (
    <section className="ui-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>{title}</h3>
      <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
        {description}
      </p>
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Aún no hay respuestas para mostrar.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.map((row, idx) => {
            const tone = cellTone(row.avg)
            return (
              <div key={`${row.label}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    width: '10rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    background: tone.bg,
                    color: tone.fg,
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.875rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {row.avg.toFixed(1)}{' '}
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({row.count} resp.)</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
