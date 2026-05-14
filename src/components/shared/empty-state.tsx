type Illustration = 'list' | 'meetings' | 'search' | 'success' | 'sparkles'

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number | string; className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  illustration?: Illustration
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  illustration,
}: EmptyStateProps) {
  if (illustration) {
    return (
      <div className={`empty-rich ${className ?? ''}`}>
        <div className="empty-rich__art">
          <EmptyArt kind={illustration} />
        </div>
        <h3 className="empty-rich__title">{title}</h3>
        {description && <p className="empty-rich__desc">{description}</p>}
        {action && <div className="empty-rich__action">{action}</div>}
      </div>
    )
  }

  return (
    <div className={`empty ${className ?? ''}`}>
      {Icon && (
        <div className="empty__icon">
          <Icon />
        </div>
      )}
      <h3 className="empty__title">{title}</h3>
      {description && <p className="empty__desc">{description}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

function EmptyArt({ kind }: { kind: Illustration }) {
  const accent = 'hsl(var(--primary))'
  const lime = 'hsl(var(--success))'
  const muted = 'hsl(var(--muted))'
  const stroke = 'hsl(var(--border))'

  switch (kind) {
    case 'list':
      return (
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="emp-list-card" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--card))" />
              <stop offset="100%" stopColor="hsl(var(--muted))" />
            </linearGradient>
            <linearGradient id="emp-list-stripe" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0.6" />
              <stop offset="100%" stopColor={lime} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <ellipse cx="90" cy="124" rx="72" ry="6" fill={muted} opacity="0.6" />
          <rect x="32" y="22" width="116" height="88" rx="12" fill="url(#emp-list-card)" stroke={stroke} />
          <rect x="32" y="22" width="116" height="6" rx="6" fill="url(#emp-list-stripe)" />
          <rect x="44" y="44" width="44" height="6" rx="3" fill={muted} />
          <rect x="44" y="58" width="92" height="6" rx="3" fill={muted} />
          <rect x="44" y="72" width="64" height="6" rx="3" fill={muted} />
          <circle cx="138" cy="48" r="6" fill={accent} opacity="0.18" />
          <circle cx="138" cy="48" r="3" fill={accent} />
        </svg>
      )
    case 'meetings':
      return (
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="emp-cal-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--card))" />
              <stop offset="100%" stopColor="hsl(var(--muted))" />
            </linearGradient>
          </defs>
          <ellipse cx="90" cy="124" rx="68" ry="6" fill={muted} opacity="0.6" />
          <rect x="36" y="20" width="108" height="92" rx="12" fill="url(#emp-cal-bg)" stroke={stroke} />
          <rect x="36" y="20" width="108" height="22" rx="12" fill={accent} />
          <rect x="36" y="32" width="108" height="10" fill={accent} />
          <circle cx="58" cy="14" r="3" fill={accent} />
          <circle cx="122" cy="14" r="3" fill={accent} />
          <line x1="58" y1="14" x2="58" y2="24" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <line x1="122" y1="14" x2="122" y2="24" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2].map(row =>
            [0, 1, 2, 3].map(col => (
              <rect
                key={`${row}-${col}`}
                x={48 + col * 22}
                y={52 + row * 18}
                width={16}
                height={12}
                rx={2.5}
                fill={muted}
                opacity={0.7}
              />
            ))
          )}
          <rect x="92" y="70" width="16" height="12" rx="2.5" fill={lime} />
        </svg>
      )
    case 'search':
      return (
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="90" cy="124" rx="58" ry="5" fill={muted} opacity="0.6" />
          <circle cx="78" cy="62" r="34" fill="hsl(var(--card))" stroke={stroke} strokeWidth="2" />
          <circle cx="78" cy="62" r="34" stroke={accent} strokeWidth="3" strokeDasharray="6 8" opacity="0.4" />
          <line x1="106" y1="86" x2="132" y2="112" stroke={accent} strokeWidth="6" strokeLinecap="round" />
          <line x1="106" y1="86" x2="132" y2="112" stroke="hsl(var(--card))" strokeWidth="2" strokeLinecap="round" />
          <path d="M62 62 Q78 50 94 62" stroke={muted} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="68" cy="56" r="2" fill={muted} />
          <circle cx="88" cy="56" r="2" fill={muted} />
        </svg>
      )
    case 'success':
      return (
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="90" cy="124" rx="58" ry="5" fill={muted} opacity="0.6" />
          <circle cx="90" cy="64" r="42" fill="hsl(var(--success) / 0.15)" stroke="hsl(var(--success))" strokeWidth="2" />
          <path d="M72 64 L84 76 L108 52" stroke="hsl(var(--success))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="38" cy="38" r="3" fill={lime} />
          <circle cx="146" cy="48" r="2.5" fill={accent} />
          <circle cx="36" cy="86" r="2" fill={accent} />
          <circle cx="148" cy="92" r="2.5" fill={lime} />
        </svg>
      )
    case 'sparkles':
      return (
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="90" cy="124" rx="58" ry="5" fill={muted} opacity="0.6" />
          <path d="M90 24 L96 56 L128 62 L96 68 L90 100 L84 68 L52 62 L84 56 Z" fill={accent} opacity="0.85" />
          <path d="M90 24 L96 56 L128 62 L96 68 L90 100 L84 68 L52 62 L84 56 Z" fill="url(#emp-spark-grad)" />
          <defs>
            <linearGradient id="emp-spark-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={accent} />
              <stop offset="100%" stopColor={lime} />
            </linearGradient>
          </defs>
          <path d="M40 36 L43 46 L53 49 L43 52 L40 62 L37 52 L27 49 L37 46 Z" fill={lime} opacity="0.7" />
          <path d="M140 78 L142 86 L150 88 L142 90 L140 98 L138 90 L130 88 L138 86 Z" fill={accent} opacity="0.6" />
        </svg>
      )
  }
}
