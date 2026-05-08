interface PageSkeletonProps {
  variant?: 'dashboard' | 'list' | 'detail'
  kpiCount?: number
  rowCount?: number
}

export function PageSkeleton({ variant = 'dashboard', kpiCount = 4, rowCount = 5 }: PageSkeletonProps) {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <div className="page__head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <span className="skel" style={{ width: 110, height: 14 }} />
          <span className="skel skel--display" style={{ width: 320, maxWidth: '70%' }} />
          <span className="skel skel--text" style={{ width: 480, maxWidth: '100%' }} />
        </div>
        <span className="skel skel--btn" />
      </div>

      {variant === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCount}, minmax(0, 1fr))`, gap: 16, marginBottom: 28 }}>
            {Array.from({ length: kpiCount }).map((_, i) => (
              <div key={i} className="ui-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="skel skel--text" style={{ width: '60%' }} />
                <span className="skel skel--display" style={{ width: '40%' }} />
                <span className="skel" style={{ height: 24, width: '100%', opacity: 0.5 }} />
              </div>
            ))}
          </div>
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card__head">
              <span className="skel skel--title" style={{ width: 180 }} />
            </div>
            <div className="ui-card__body--flush">
              {Array.from({ length: rowCount }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
        </>
      )}

      {variant === 'list' && (
        <div className="u-col">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="ui-card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="skel skel--avatar" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="skel skel--text" style={{ width: '50%' }} />
                <span className="skel skel--text" style={{ width: '30%', opacity: 0.6 }} />
              </div>
              <span className="skel skel--btn" style={{ width: 72 }} />
            </div>
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24 }}>
          <div className="u-col">
            <div className="ui-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="skel skel--title" style={{ width: 240 }} />
              <span className="skel skel--text" style={{ width: '70%' }} />
              <span className="skel skel--text" style={{ width: '50%' }} />
            </div>
            <div className="ui-card" style={{ padding: 24 }}>
              <span className="skel skel--title" style={{ width: 160, marginBottom: 14, display: 'block' }} />
              <div className="skel-stack">
                <span className="skel skel--text" style={{ width: '90%' }} />
                <span className="skel skel--text" style={{ width: '80%' }} />
                <span className="skel skel--text" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
          <div className="u-col">
            <div className="ui-card skel skel--card" />
            <div className="ui-card skel skel--card" style={{ height: 80 }} />
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="up-row" style={{ borderBottom: '1px solid var(--border-c)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', borderRight: '1px solid var(--border-c)', paddingRight: 14 }}>
        <span className="skel" style={{ width: 30, height: 18 }} />
        <span className="skel" style={{ width: 22, height: 10 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="skel skel--text" style={{ width: '60%' }} />
        <span className="skel skel--text" style={{ width: '30%', opacity: 0.6 }} />
      </div>
      <span className="skel skel--btn" style={{ width: 84 }} />
    </div>
  )
}
